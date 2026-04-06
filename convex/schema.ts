// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // ─── Legacy 3-tier flat tables (untouched) ────────────────────────────────

  categories: defineTable({
    code: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_code", ["code"]),

  subcategories: defineTable({
    categoryCode: v.string(),
    code: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_category", ["categoryCode"])
    .index("by_code", ["code"])
    .index("by_category_code", ["categoryCode", "code"]),

  groups: defineTable({
    subcategoryCode: v.string(),
    code: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    metadata: v.optional(v.any()),
    categoryCode: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_subcategory", ["subcategoryCode"])
    .index("by_code", ["code"])
    .index("by_subcategory_code", ["subcategoryCode", "code"]),

  stickers: defineTable({
    code: v.string(),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    filename: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    isActive: v.boolean(),
    categoryCode: v.optional(v.string()),
    subcategoryCode: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_subcategory", ["subcategoryCode"])
    .index("by_category", ["categoryCode"]),

  stickerGroupLinks: defineTable({
    stickerCode: v.string(),
    groupCode: v.string(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_sticker", ["stickerCode"])
    .index("by_group", ["groupCode"]),

  // ─── Taxonomy Engine: recursive, infinitely nestable ─────────────────────
  //
  // Each node can be any tier: domain → category → subcategory → group →
  // attribute → … The `type` field is the semantic label; parentId creates
  // the tree. Root nodes have no parentId.
  //
  // De-duplication key: (parentId, slug) is unique per tree level.

  taxonomy: defineTable({
    name: v.string(),
    slug: v.string(),
    parentId: v.optional(v.id("taxonomy")),
    type: v.union(
      v.literal("domain"),
      v.literal("category"),
      v.literal("subcategory"),
      v.literal("group"),
      v.literal("attribute"),
    ),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_parent", ["parentId"])
    .index("by_type", ["type"])
    .index("by_parent_slug", ["parentId", "slug"]),

  // Junction: one sticker can belong to many taxonomy nodes
  stickerTaxonomyLinks: defineTable({
    stickerId: v.id("stickers"),
    taxonomyId: v.id("taxonomy"),
    createdAt: v.number(),
  })
    .index("by_sticker", ["stickerId"])
    .index("by_taxonomy", ["taxonomyId"])
    .index("by_sticker_taxonomy", ["stickerId", "taxonomyId"]),
});
