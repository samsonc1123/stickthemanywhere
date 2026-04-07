// convex/redesign.ts
//
// Redesign-AI: Analyzer Agent queries and mutations.
// Operates on the `redesignLeads` Input Layer table.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const trustSignalValidator = v.union(
  v.literal("reviews"),
  v.literal("social-proof"),
  v.literal("security-seals"),
  v.literal("testimonials"),
  v.literal("awards"),
  v.literal("press-mentions"),
  v.literal("money-back-guarantee"),
  v.literal("certifications"),
);

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Primary target list: all active leads with visualScore < 4.
 * Sorted by visualScore ascending so the weakest sites surface first.
 */
export const checkLeadsForRedesign = query({
  args: {
    threshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cutoff = args.threshold ?? 4;

    const leads = await ctx.db
      .query("redesignLeads")
      .filter((q) =>
        q.and(
          q.eq(q.field("isActive"), true),
          q.lt(q.field("visualScore"), cutoff)
        )
      )
      .collect();

    return leads.sort((a, b) => a.visualScore - b.visualScore);
  },
});

/**
 * Full lead list — no filter. Used for dashboard views.
 * Optional `mobileOnly` flag narrows to non-responsive sites.
 */
export const getAllLeads = query({
  args: {
    mobileOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let leads = await ctx.db
      .query("redesignLeads")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (args.mobileOnly === true) {
      leads = leads.filter((l) => l.hasMobileResponsiveness === false);
    }

    return leads.sort((a, b) => a.visualScore - b.visualScore);
  },
});

/**
 * Fetch a single lead by URL. Returns null if not found.
 */
export const getLeadByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("redesignLeads")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Ingest a new lead into the Input Layer.
 * Idempotent on URL — if the URL already exists, updates the existing record
 * instead of inserting a duplicate.
 * Returns { id, created: boolean }.
 */
export const ingestLead = mutation({
  args: {
    businessName: v.string(),
    url: v.string(),
    visualScore: v.number(),
    hasMobileResponsiveness: v.boolean(),
    ctaCount: v.number(),
    loadTimeSpeed: v.number(),
    trustSignals: v.array(trustSignalValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("redesignLeads")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        businessName: args.businessName,
        visualScore: args.visualScore,
        hasMobileResponsiveness: args.hasMobileResponsiveness,
        ctaCount: args.ctaCount,
        loadTimeSpeed: args.loadTimeSpeed,
        trustSignals: args.trustSignals,
        notes: args.notes,
        updatedAt: now,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("redesignLeads", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { id, created: true };
  },
});

/**
 * Update only the analyzer scores on an existing lead.
 * Useful when the Analyzer Agent re-scans a site without changing
 * the business metadata.
 */
export const updateScores = mutation({
  args: {
    id: v.id("redesignLeads"),
    visualScore: v.optional(v.number()),
    hasMobileResponsiveness: v.optional(v.boolean()),
    ctaCount: v.optional(v.number()),
    loadTimeSpeed: v.optional(v.number()),
    trustSignals: v.optional(v.array(trustSignalValidator)),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    return { id };
  },
});

/**
 * Soft-delete a lead. Preserves the record for audit history.
 */
export const deactivateLead = mutation({
  args: { id: v.id("redesignLeads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false, updatedAt: Date.now() });
    return { id: args.id };
  },
});
