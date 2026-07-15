import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getStickersByGroupCode = query({
  args: {
    groupCode: v.string(),
  },
  handler: async (ctx, args) => {
    const groupCode = args.groupCode.trim().toUpperCase();

    const links = await ctx.db
      .query("stickerGroupLinks")
      .withIndex("by_group", (q) => q.eq("groupCode", groupCode))
      .collect();

    const results = [];
    for (const link of links) {
      const sticker = await ctx.db
        .query("stickers")
        .withIndex("by_code", (q) => q.eq("code", link.stickerCode))
        .unique();

      if (!sticker || !sticker.isActive) continue;

      let imageUrl: string | null = null;
      if (sticker.storageId) {
        imageUrl = await ctx.storage.getUrl(sticker.storageId);
      }

      results.push({ ...sticker, imageUrl });
    }

    return results;
  },
});

export const getStickerCountsByGroupCodes = query({
  args: {
    groupCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    for (const code of args.groupCodes) {
      counts[code] = 0;
    }
    const links = await ctx.db.query("stickerGroupLinks").collect();
    for (const link of links) {
      if (link.groupCode in counts) {
        counts[link.groupCode] += 1;
      }
    }
    return counts;
  },
});

export const getStickersBySubcategory = query({
  args: { subcategoryCode: v.string() },
  handler: async (ctx, { subcategoryCode }) => {
    const stickers = await ctx.db
      .query("stickers")
      .withIndex("by_subcategory", q => q.eq("subcategoryCode", subcategoryCode.toUpperCase()))
      .collect();

    const results = [];
    for (const s of stickers) {
      const imageUrl = s.storageId ? await ctx.storage.getUrl(s.storageId) : null;
      results.push({ ...s, imageUrl });
    }
    return results.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

export const updateSortOrders = mutation({
  args: { updates: v.array(v.object({ id: v.id("stickers"), sortOrder: v.number() })) },
  handler: async (ctx, { updates }) => {
    for (const { id, sortOrder } of updates) {
      await ctx.db.patch(id, { sortOrder, updatedAt: Date.now() });
    }
    return { updated: updates.length };
  },
});

export const listAllStickers = query({
  args: {},
  handler: async (ctx) => {
    const stickers = await ctx.db.query("stickers").collect();
    return stickers
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 100);
  },
});

export const finalizeStickerUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    categoryCode: v.optional(v.string()),
    subcategoryCode: v.string(),
    filename: v.string(),
  },

  handler: async (ctx, args) => {
    const subcategoryCode = args.subcategoryCode.trim().toUpperCase();

    if (!subcategoryCode) {
      throw new Error("subcategoryCode is required.");
    }

    // 1 — Validate subcategory exists
    const subcat = await ctx.db
      .query("subcategories")
      .withIndex("by_code", (q) => q.eq("code", subcategoryCode))
      .unique();

    if (!subcat) {
      throw new Error(`Subcategory code "${subcategoryCode}" does not exist.`);
    }

    // 2 — Idempotency check
    const existingByStorage = await ctx.db
      .query("stickers")
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .unique();

    if (existingByStorage) {
      return {
        id: existingByStorage._id,
        code: existingByStorage.code,
        alreadyExists: true,
      };
    }

    // 3 — Generate sequential code
    // Use by_subcategory index — O(k) not O(n), collision-safe by construction
    const prefix = subcat.code;

    const subcatStickers = await ctx.db
      .query("stickers")
      .withIndex("by_subcategory", (q) => q.eq("subcategoryCode", subcategoryCode))
      .collect();

    const maxNum = subcatStickers.reduce((max, s) => {
      // Code format: PREFIX-NNNNN (e.g. FLO-ROS-00042)
      // Strip "PREFIX-" to isolate the numeric suffix
      const suffix = s.code.startsWith(prefix + "-")
        ? s.code.slice(prefix.length + 1)
        : s.code.slice(prefix.length);
      const num = parseInt(suffix, 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);

    const nextNum = maxNum + 1;
    const code = `${prefix}-${String(nextNum).padStart(5, "0")}`;

    // 4 — Final uniqueness check
    const dupe = await ctx.db
      .query("stickers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (dupe) {
      throw new Error(`Sticker code ${code} already exists. Please retry.`);
    }

    // 5 — Authoritative category
    const derivedCategoryCode = subcat.categoryCode;

    const now = Date.now();

    const id = await ctx.db.insert("stickers", {
      code,
      name: args.name,
      filename: args.filename,
      storageId: args.storageId,
      categoryCode: derivedCategoryCode,
      subcategoryCode: subcat.code,
      isActive: true,
      price: 4.0,
      sortOrder: nextNum,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      code,
      alreadyExists: false,
    };
  },
});