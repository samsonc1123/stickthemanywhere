// convex/floraFauna.ts
//
// Flora Fana — Nature Intelligence Layer.
// Safety-first logic for species lookup, risk classification,
// and immediate action guidance.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Shared validators ────────────────────────────────────────────────────────

const dangerLevelValidator = v.union(
  v.literal("safe"),
  v.literal("caution"),
  v.literal("danger"),
);

// Maps dangerLevel → display color code
const COLOR_MAP: Record<string, "GREEN" | "YELLOW" | "RED"> = {
  safe: "GREEN",
  caution: "YELLOW",
  danger: "RED",
};

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Primary alert query for the Flora Fana safety layer.
 *
 * Takes a speciesId (taxonomy node id) and returns:
 *   - colorCode: "GREEN" | "YELLOW" | "RED"
 *   - dangerLevel: "safe" | "caution" | "danger"
 *   - humanRisk, petRisk, immediateAction from safetyProtocols
 *   - species name and slug for display
 *
 * Returns null if the species does not exist.
 * Returns a WARNING payload if no safetyProtocol has been authored yet.
 */
export const getSafetyAlert = query({
  args: {
    speciesId: v.id("taxonomy"),
  },
  handler: async (ctx, args) => {
    const species = await ctx.db.get(args.speciesId);
    if (!species) return null;

    const dangerLevel = species.dangerLevel ?? "caution";
    const colorCode = COLOR_MAP[dangerLevel];

    const protocol = await ctx.db
      .query("safetyProtocols")
      .withIndex("by_taxonomy", (q) => q.eq("taxonomyId", args.speciesId))
      .unique();

    if (!protocol) {
      return {
        speciesId: args.speciesId,
        name: species.name,
        slug: species.slug,
        colorCode,
        dangerLevel,
        humanRisk: "No protocol on file — treat as CAUTION.",
        petRisk: "No protocol on file — keep pets away until assessed.",
        immediateAction: "Consult a specialist before handling.",
        symptoms: [],
        antidote: null,
        protocolMissing: true,
      };
    }

    return {
      speciesId: args.speciesId,
      name: species.name,
      slug: species.slug,
      colorCode,
      dangerLevel,
      humanRisk: protocol.humanRisk,
      petRisk: protocol.petRisk,
      immediateAction: protocol.immediateAction,
      symptoms: protocol.symptoms ?? [],
      antidote: protocol.antidote ?? null,
      protocolMissing: false,
    };
  },
});

/**
 * Fetch all species at a given danger level with their full safety protocols.
 * Useful for generating bulk alert lists (e.g. "all RED species in database").
 */
export const getSpeciesByDangerLevel = query({
  args: {
    dangerLevel: dangerLevelValidator,
  },
  handler: async (ctx, args) => {
    const species = await ctx.db
      .query("taxonomy")
      .withIndex("by_danger_level", (q) =>
        q.eq("dangerLevel", args.dangerLevel)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const results = await Promise.all(
      species.map(async (s) => {
        const protocol = await ctx.db
          .query("safetyProtocols")
          .withIndex("by_taxonomy", (q) => q.eq("taxonomyId", s._id))
          .unique();

        return {
          speciesId: s._id,
          name: s.name,
          slug: s.slug,
          colorCode: COLOR_MAP[args.dangerLevel],
          dangerLevel: args.dangerLevel,
          protocol: protocol ?? null,
        };
      })
    );

    return results;
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Set the dangerLevel on a taxonomy species node.
 * This is the fast-lookup signal used by getSafetyAlert.
 */
export const setDangerLevel = mutation({
  args: {
    speciesId: v.id("taxonomy"),
    dangerLevel: dangerLevelValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.speciesId, {
      dangerLevel: args.dangerLevel,
      updatedAt: Date.now(),
    });
    return { speciesId: args.speciesId, dangerLevel: args.dangerLevel };
  },
});

/**
 * Upsert a safety protocol for a species.
 * Idempotent — one protocol per taxonomy node.
 * If one already exists, all provided fields are overwritten.
 */
export const upsertSafetyProtocol = mutation({
  args: {
    taxonomyId: v.id("taxonomy"),
    humanRisk: v.string(),
    petRisk: v.string(),
    immediateAction: v.string(),
    symptoms: v.optional(v.array(v.string())),
    antidote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("safetyProtocols")
      .withIndex("by_taxonomy", (q) => q.eq("taxonomyId", args.taxonomyId))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        humanRisk: args.humanRisk,
        petRisk: args.petRisk,
        immediateAction: args.immediateAction,
        symptoms: args.symptoms,
        antidote: args.antidote,
        updatedAt: now,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("safetyProtocols", {
      taxonomyId: args.taxonomyId,
      humanRisk: args.humanRisk,
      petRisk: args.petRisk,
      immediateAction: args.immediateAction,
      symptoms: args.symptoms,
      antidote: args.antidote,
      createdAt: now,
      updatedAt: now,
    });

    return { id, created: true };
  },
});
