import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

    // 2 — Block taxonomy bucket/test uploads
    const filenameUpper = args.filename.toUpperCase();

    if (
      filenameUpper.includes("-GEN-") ||
      filenameUpper.includes("-LGD-") ||
      filenameUpper.includes("-TEST-")
    ) {
      throw new Error(
        `Bucket/test filenames are not allowed as stickers: "${args.filename}"`
      );
    }

    // 3 — Enforce filename prefix
    const nameOnly = args.filename.replace(/\.(png|webp)$/i, "");
    const nameOnlyUpper = nameOnly.toUpperCase();
    const requiredPrefix = `${subcat.code}-`;

    if (!nameOnlyUpper.startsWith(requiredPrefix)) {
      throw new Error(
        `Filename must start with "${requiredPrefix}" (got "${args.filename}").`
      );
    }

    // 4 — Idempotency check
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

    // 5 — Generate sequential code
    const prefix = subcat.code;

    const allStickers = await ctx.db.query("stickers").collect();

    const matchingNums = allStickers
      .filter((s) => typeof s.code === "string" && s.code.startsWith(prefix))
      .map((s) => {
        const num = parseInt(s.code.slice(prefix.length), 10);
        return Number.isFinite(num) ? num : 0;
      });

    const nextNum = matchingNums.length ? Math.max(...matchingNums) + 1 : 1;

    const code = `${prefix}${String(nextNum).padStart(5, "0")}`;

    // 6 — Final uniqueness check
    const dupe = await ctx.db
      .query("stickers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (dupe) {
      throw new Error(`Sticker code ${code} already exists. Please retry.`);
    }

    // 7 — Authoritative category
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