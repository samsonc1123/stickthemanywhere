// convex/merch.ts
//
// Merch Designs — MAGA POD layer.
// Handles design ingestion, taxonomy linking, and weighted ranking.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Shared validators ────────────────────────────────────────────────────────

const productTypeValidator = v.union(
  v.literal("tee"),
  v.literal("hoodie"),
  v.literal("sticker"),
  v.literal("mug"),
);

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Returns active designs sorted by gematriaWeight descending.
 * The highest-significance designs surface first.
 *
 * Optional filters:
 *   limit       — cap the result set (default: 20)
 *   productType — narrow to a specific product type
 *   taxonomyId  — narrow to a specific Spiritual Domain node
 */
export const getTopWeightedDesigns = query({
  args: {
    limit:       v.optional(v.number()),
    productType: v.optional(productTypeValidator),
    taxonomyId:  v.optional(v.id("taxonomy")),
  },
  handler: async (ctx, args) => {
    const cap = args.limit ?? 20;

    let designs = await ctx.db
      .query("merchDesigns")
      .withIndex("by_gematria_weight")
      .order("desc")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (args.productType) {
      designs = designs.filter((d) => d.productType === args.productType);
    }

    if (args.taxonomyId) {
      designs = designs.filter((d) => d.taxonomyId === args.taxonomyId);
    }

    const capped = designs.slice(0, cap);

    // Attach taxonomy node name if linked
    return Promise.all(
      capped.map(async (d) => {
        const taxNode = d.taxonomyId ? await ctx.db.get(d.taxonomyId) : null;
        return {
          ...d,
          domain: taxNode
            ? { id: taxNode._id, name: taxNode.name, slug: taxNode.slug }
            : null,
        };
      })
    );
  },
});

/**
 * Fetch a single design by its acronym (e.g. "MAGA", "WWG1WGA").
 * Returns null if not found.
 */
export const getDesignByAcronym = query({
  args: { acronym: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("merchDesigns")
      .withIndex("by_acronym", (q) =>
        q.eq("acronym", args.acronym.toUpperCase())
      )
      .unique();
  },
});

/**
 * All designs for a specific product type, sorted by gematriaWeight descending.
 */
export const getDesignsByProductType = query({
  args: { productType: productTypeValidator },
  handler: async (ctx, args) => {
    return ctx.db
      .query("merchDesigns")
      .withIndex("by_product_type", (q) =>
        q.eq("productType", args.productType)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()
      .then((rows) => rows.sort((a, b) => b.gematriaWeight - a.gematriaWeight));
  },
});

/**
 * All designs under a given taxonomy domain node (e.g. "Spiritual", "General").
 */
export const getDesignsByDomain = query({
  args: { taxonomyId: v.id("taxonomy") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("merchDesigns")
      .withIndex("by_taxonomy", (q) => q.eq("taxonomyId", args.taxonomyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()
      .then((rows) => rows.sort((a, b) => b.gematriaWeight - a.gematriaWeight));
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Ingest a new merch design. Idempotent on acronym + productType pair.
 * If the same acronym already exists for that product type, updates it
 * instead of inserting a duplicate.
 *
 * Returns { id, created: boolean }.
 */
export const upsertDesign = mutation({
  args: {
    acronym:        v.string(),
    fullMeaning:    v.string(),
    gematriaWeight: v.number(),
    highResPath:    v.string(),
    productType:    productTypeValidator,
    taxonomyId:     v.optional(v.id("taxonomy")),
    notes:          v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now     = Date.now();
    const acronym = args.acronym.toUpperCase();

    const existing = await ctx.db
      .query("merchDesigns")
      .withIndex("by_acronym", (q) => q.eq("acronym", acronym))
      .filter((q) => q.eq(q.field("productType"), args.productType))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        fullMeaning:    args.fullMeaning,
        gematriaWeight: args.gematriaWeight,
        highResPath:    args.highResPath,
        taxonomyId:     args.taxonomyId,
        notes:          args.notes,
        updatedAt:      now,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("merchDesigns", {
      acronym,
      fullMeaning:    args.fullMeaning,
      gematriaWeight: args.gematriaWeight,
      highResPath:    args.highResPath,
      productType:    args.productType,
      taxonomyId:     args.taxonomyId,
      notes:          args.notes,
      isActive:       true,
      createdAt:      now,
      updatedAt:      now,
    });

    return { id, created: true };
  },
});

/**
 * Update the gematriaWeight on an existing design.
 * Use this when the Gematria engine recalculates significance.
 */
export const updateGematriaWeight = mutation({
  args: {
    id:             v.id("merchDesigns"),
    gematriaWeight: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      gematriaWeight: args.gematriaWeight,
      updatedAt:      Date.now(),
    });
    return { id: args.id, gematriaWeight: args.gematriaWeight };
  },
});

/**
 * Link or re-link a design to a taxonomy domain node.
 */
export const assignDomain = mutation({
  args: {
    id:         v.id("merchDesigns"),
    taxonomyId: v.id("taxonomy"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      taxonomyId: args.taxonomyId,
      updatedAt:  Date.now(),
    });
    return { id: args.id, taxonomyId: args.taxonomyId };
  },
});

/**
 * Soft-delete a design. Record is preserved for audit history.
 */
export const deactivateDesign = mutation({
  args: { id: v.id("merchDesigns") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false, updatedAt: Date.now() });
    return { id: args.id };
  },
});
