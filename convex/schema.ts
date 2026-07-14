import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({

  users: defineTable({
    email: v.string(),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  }).index("by_email", ["email"]),

  magicTokens: defineTable({
    email: v.string(),
    token: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  adminSessions: defineTable({
    email: v.string(),
    sessionId: v.string(),
    expiresAt: v.number(),
  }).index("by_session_id", ["sessionId"]),

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
    numericalWeight: v.optional(v.number()),
    dangerLevel: v.optional(v.union(
      v.literal("safe"),
      v.literal("caution"),
      v.literal("danger"),
    )),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_parent", ["parentId"])
    .index("by_type", ["type"])
    .index("by_parent_slug", ["parentId", "slug"])
    .index("by_numerical_weight", ["numericalWeight"])
    .index("by_danger_level", ["dangerLevel"]),

  safetyProtocols: defineTable({
    taxonomyId: v.id("taxonomy"),
    humanRisk: v.string(),
    petRisk: v.string(),
    immediateAction: v.string(),
    symptoms: v.optional(v.array(v.string())),
    antidote: v.optional(v.string()),
    primateSafety: v.optional(v.object({
      fridgeAccessRisk: v.boolean(),
      dexterityWarning: v.string(),
      kombuchaCompatibility: v.boolean(),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_taxonomy", ["taxonomyId"]),

  redesignLeads: defineTable({
    businessName: v.string(),
    url: v.string(),
    visualScore: v.number(),
    hasMobileResponsiveness: v.boolean(),
    ctaCount: v.number(),
    loadTimeSpeed: v.number(),
    trustSignals: v.array(v.union(
      v.literal("reviews"),
      v.literal("social-proof"),
      v.literal("security-seals"),
      v.literal("testimonials"),
      v.literal("awards"),
      v.literal("press-mentions"),
      v.literal("money-back-guarantee"),
      v.literal("certifications"),
    )),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_visual_score", ["visualScore"])
    .index("by_url", ["url"])
    .index("by_mobile_responsiveness", ["hasMobileResponsiveness"]),

  merchDesigns: defineTable({
    acronym: v.string(),
    fullMeaning: v.string(),
    gematriaWeight: v.number(),
    highResPath: v.string(),
    productType: v.union(
      v.literal("tee"),
      v.literal("hoodie"),
      v.literal("sticker"),
      v.literal("mug"),
    ),
    taxonomyId: v.optional(v.id("taxonomy")),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_acronym", ["acronym"])
    .index("by_gematria_weight", ["gematriaWeight"])
    .index("by_product_type", ["productType"])
    .index("by_taxonomy", ["taxonomyId"]),

  trinityProducts: defineTable({
    productName: v.string(),
    function: v.union(
      v.literal("relief"),
      v.literal("alignment"),
      v.literal("geometric"),
    ),
    frequencyHz: v.number(),
    syncEnabled: v.boolean(),
    taxonomyId: v.optional(v.id("taxonomy")),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_function", ["function"])
    .index("by_frequency", ["frequencyHz"])
    .index("by_taxonomy", ["taxonomyId"]),

  atmosphereRooms: defineTable({
    roomName: v.string(),
    activeFrequencyHz: v.number(),
    trinityProductId: v.optional(v.id("trinityProducts")),
    devices: v.object({
      pacifier:  v.object({ synced: v.boolean(), frequencyHz: v.number() }),
      mattress:  v.object({ synced: v.boolean(), frequencyHz: v.number() }),
      lighting:  v.object({ synced: v.boolean(), frequencyHz: v.number() }),
    }),
    lastSyncedAt: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_frequency", ["activeFrequencyHz"])
    .index("by_product", ["trinityProductId"]),

  stickerTaxonomyLinks: defineTable({
    stickerId: v.id("stickers"),
    taxonomyId: v.id("taxonomy"),
    createdAt: v.number(),
  })
    .index("by_sticker", ["stickerId"])
    .index("by_taxonomy", ["taxonomyId"])
    .index("by_sticker_taxonomy", ["stickerId", "taxonomyId"]),
});
