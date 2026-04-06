// convex/taxonomy.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const taxonomyType = v.union(
  v.literal("domain"),
  v.literal("category"),
  v.literal("subcategory"),
  v.literal("group"),
  v.literal("attribute"),
);

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Idempotent upsert. De-duplicates on (parentId, slug).
 *
 * - If a node with the same slug already exists under the same parent,
 *   returns the existing id without inserting a duplicate.
 * - If `slug` is omitted it is derived from `name` automatically.
 * - Returns { id, created: boolean } so callers know if it was new.
 */
export const upsertNode = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    parentId: v.optional(v.id("taxonomy")),
    type: taxonomyType,
    sortOrder: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const slug = args.slug ? toSlug(args.slug) : toSlug(args.name);
    const now = Date.now();

    // De-dup check: same slug under the same parent
    const existing = await ctx.db
      .query("taxonomy")
      .withIndex("by_parent_slug", (q) =>
        q.eq("parentId", args.parentId).eq("slug", slug)
      )
      .unique();

    if (existing !== null) {
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("taxonomy", {
      name: args.name,
      slug,
      parentId: args.parentId,
      type: args.type,
      isActive: true,
      sortOrder: args.sortOrder,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return { id, created: true };
  },
});

/**
 * Link a sticker to a taxonomy node. Idempotent — safe to call multiple times.
 */
export const linkStickerToTaxonomy = mutation({
  args: {
    stickerId: v.id("stickers"),
    taxonomyId: v.id("taxonomy"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stickerTaxonomyLinks")
      .withIndex("by_sticker_taxonomy", (q) =>
        q.eq("stickerId", args.stickerId).eq("taxonomyId", args.taxonomyId)
      )
      .unique();

    if (existing !== null) {
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("stickerTaxonomyLinks", {
      stickerId: args.stickerId,
      taxonomyId: args.taxonomyId,
      createdAt: Date.now(),
    });

    return { id, created: true };
  },
});

/**
 * Deactivate a node (soft delete). Does NOT touch children —
 * callers decide whether to cascade.
 */
export const deactivateNode = mutation({
  args: { id: v.id("taxonomy") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false, updatedAt: Date.now() });
    return { id: args.id };
  },
});

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Fetch a single node by its slug. Null if not found. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("taxonomy")
      .withIndex("by_slug", (q) => q.eq("slug", toSlug(args.slug)))
      .unique();
  },
});

/** Fetch a single node by id. */
export const getById = query({
  args: { id: v.id("taxonomy") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

/** Fetch all direct children of a node (or all root nodes if parentId omitted). */
export const getChildren = query({
  args: {
    parentId: v.optional(v.id("taxonomy")),
    type: v.optional(taxonomyType),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("taxonomy")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    const active = rows.filter((r) => r.isActive);
    if (args.type) return active.filter((r) => r.type === args.type);
    return active;
  },
});

/** Fetch all taxonomy nodes linked to a sticker. */
export const getTaxonomyForSticker = query({
  args: { stickerId: v.id("stickers") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("stickerTaxonomyLinks")
      .withIndex("by_sticker", (q) => q.eq("stickerId", args.stickerId))
      .collect();

    const nodes = await Promise.all(links.map((l) => ctx.db.get(l.taxonomyId)));
    return nodes.filter(Boolean);
  },
});

/** Fetch all stickers linked to a taxonomy node. */
export const getStickersForTaxonomy = query({
  args: { taxonomyId: v.id("taxonomy") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("stickerTaxonomyLinks")
      .withIndex("by_taxonomy", (q) => q.eq("taxonomyId", args.taxonomyId))
      .collect();

    const stickers = await Promise.all(
      links.map((l) => ctx.db.get(l.stickerId))
    );
    return stickers.filter(Boolean);
  },
});

/**
 * Walk the tree upward from a node to the root.
 * Returns the ancestry path: [root, …, parent, node].
 */
export const getAncestors = query({
  args: { id: v.id("taxonomy") },
  handler: async (ctx, args) => {
    const path: Awaited<ReturnType<typeof ctx.db.get>>[] = [];
    let current: Id<"taxonomy"> | undefined = args.id;

    while (current !== undefined) {
      const node = await ctx.db.get(current);
      if (!node) break;
      path.unshift(node);
      current = node.parentId;
    }

    return path;
  },
});
