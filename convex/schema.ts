// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

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
});