import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db.query("stickers")
      .order("desc")
      .first();
    const storageActive = recent?.storageId != null;
    const lastCode = recent?.name ?? recent?.subcategoryCode ?? null;
    return { storageActive, lastCode };
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derives a 3-character uppercase abbreviation from a character name.
 * "Chewbacca"                  → CHE
 * "Darth Vader"                → DVA
 * "Luke Skywalker"             → LSU
 * "Din Djarin (The Mandalorian)" → DDI
 * "R2-D2"                      → R2D
 */
function charAbbrev(name: string): string {
  // Strip parenthetical content, hyphens-as-separators → spaces, collapse whitespace
  const clean = name
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/-/g, " ")
    .trim()
    .toUpperCase();

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "XXX";

  const initials = words.map((w) => w[0]).join("");
  if (initials.length >= 3) return initials.slice(0, 3);

  // Pad with extra letters from the first word
  return (initials + words[0].slice(1)).slice(0, 3).padEnd(3, "X");
}

// ─── Queries ─────────────────────────────────────────────────────────────────

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

export const listAllStickers = query({
  args: {},
  handler: async (ctx) => {
    const stickers = await ctx.db.query("stickers").collect();
    const sorted = stickers
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 100);
    const results = [];
    for (const s of sorted) {
      const imageUrl = s.storageId ? await ctx.storage.getUrl(s.storageId) : null;
      results.push({ ...s, imageUrl });
    }
    return results;
  },
});

export const getStickersByCategory = query({
  args: { categoryCode: v.string() },
  handler: async (ctx, { categoryCode }) => {
    const stickers = await ctx.db
      .query("stickers")
      .withIndex("by_category", (q) => q.eq("categoryCode", categoryCode.toUpperCase()))
      .collect();

    const results: Record<string, any[]> = {};
    for (const s of stickers) {
      if (!s.isActive) continue;
      const key = s.subcategoryCode ?? "UNKNOWN";
      if (!results[key]) results[key] = [];
      const imageUrl = s.storageId ? await ctx.storage.getUrl(s.storageId) : null;
      results[key].push({ ...s, imageUrl });
    }
    return results;
  },
});

export const getStaticClingStickers = query({
  args: {},
  handler: async (ctx) => {
    const stickers = await ctx.db
      .query("stickers")
      .withIndex("by_category", (q) => q.eq("categoryCode", "SCP"))
      .collect();

    const results: Record<string, any[]> = {};
    for (const s of stickers) {
      if (!s.isActive) continue;
      const key = s.subcategoryCode ?? "UNKNOWN";
      if (!results[key]) results[key] = [];
      const imageUrl = s.storageId ? await ctx.storage.getUrl(s.storageId) : null;
      results[key].push({ ...s, imageUrl });
    }
    return results;
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const updateSortOrders = mutation({
  args: { updates: v.array(v.object({ id: v.id("stickers"), sortOrder: v.number() })) },
  handler: async (ctx, { updates }) => {
    for (const { id, sortOrder } of updates) {
      await ctx.db.patch(id, { sortOrder, updatedAt: Date.now() });
    }
    return { updated: updates.length };
  },
});

/**
 * finalizeStickerUpload
 *
 * Code format: {SUBCAT}-{CHAR}-{NNNNN}
 * e.g. MOV-STW-CHE-00001  (Star Wars → Chewbacca sticker #1)
 *      MOV-STW-DVA-00001  (Star Wars → Darth Vader sticker #1)
 *      MOV-STW-DVA-00002  (Star Wars → Darth Vader sticker #2)
 *
 * The character abbreviation is derived from the part after " - " in `name`.
 * If no " - " separator exists, falls back to the full name for abbrev generation.
 */
export const finalizeStickerUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    categoryCode: v.optional(v.string()),
    subcategoryCode: v.string(),
    filename: v.string(),
    isFranchise: v.optional(v.boolean()),
  },

  handler: async (ctx, args) => {
    const subcategoryCode = args.subcategoryCode.trim().toUpperCase();
    const isFranchise = args.isFranchise ?? false;

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

    const subcatStickers = await ctx.db
      .query("stickers")
      .withIndex("by_subcategory", (q) => q.eq("subcategoryCode", subcategoryCode))
      .collect();

    let code: string;
    let nextNum: number;

    if (isFranchise) {
      // 3a — Franchise pipeline: {SUBCAT}-{CHAR_ABBREV}-{NNNNN}
      // e.g. MOV-STW-DVA-00001
      const separatorIdx = args.name.indexOf(" - ");
      const characterPart =
        separatorIdx !== -1 ? args.name.slice(separatorIdx + 3) : args.name;
      const abbrev = charAbbrev(characterPart); // e.g. "DVA"
      const charPrefix = `${subcat.code}-${abbrev}`;

      const maxNum = subcatStickers.reduce((max, s) => {
        if (!s.code.startsWith(charPrefix + "-")) return max;
        const suffix = s.code.slice(charPrefix.length + 1);
        const num = parseInt(suffix, 10);
        return Number.isFinite(num) && num > max ? num : max;
      }, 0);

      nextNum = maxNum + 1;
      code = `${charPrefix}-${String(nextNum).padStart(5, "0")}`;
    } else {
      // 3b — Simple pipeline: {SUBCAT}-{NNNNN}
      // e.g. FSH-JOR-00001
      const maxNum = subcatStickers.reduce((max, s) => {
        const last = s.code.split("-").pop() ?? "";
        if (s.code.startsWith(subcat.code + "-") && /^\d{5}$/.test(last)) {
          const num = parseInt(last, 10);
          return Number.isFinite(num) && num > max ? num : max;
        }
        return max;
      }, 0);

      nextNum = maxNum + 1;
      code = `${subcat.code}-${String(nextNum).padStart(5, "0")}`;
    }

    // 5 — Final uniqueness check
    const dupe = await ctx.db
      .query("stickers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (dupe) {
      throw new Error(`Sticker code ${code} already exists. Please retry.`);
    }

    // 6 — Authoritative category
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

export const updateStickerImage = mutation({
  args: { id: v.id("stickers"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    await ctx.db.patch(id, { storageId, updatedAt: Date.now() });
    return { updated: true };
  },
});

export const updateStickerName = mutation({
  args: { code: v.string(), name: v.string() },
  handler: async (ctx, { code, name }) => {
    const sticker = await ctx.db
      .query("stickers")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!sticker) throw new Error(`Sticker "${code}" not found`);
    await ctx.db.patch(sticker._id, { name, updatedAt: Date.now() });
    return { updated: true, code: sticker.code, name };
  },
});

/**
 * fixStickerCodeAndName
 *
 * One-time correction tool: renames both the sticker code and display name,
 * and patches any stickerGroupLinks that reference the old code.
 */
export const fixStickerCodeAndName = mutation({
  args: {
    oldCode: v.string(),
    newCode: v.string(),
    newName: v.string(),
  },
  handler: async (ctx, { oldCode, newCode, newName }) => {
    const OLD = oldCode.toUpperCase();
    const NEW = newCode.toUpperCase();

    const sticker = await ctx.db
      .query("stickers")
      .withIndex("by_code", (q) => q.eq("code", OLD))
      .unique();

    if (!sticker) throw new Error(`Sticker "${OLD}" not found`);

    // Check new code doesn't already exist (unless it's the same record)
    if (NEW !== OLD) {
      const conflict = await ctx.db
        .query("stickers")
        .withIndex("by_code", (q) => q.eq("code", NEW))
        .unique();
      if (conflict) throw new Error(`Code "${NEW}" already exists`);
    }

    await ctx.db.patch(sticker._id, {
      code: NEW,
      name: newName,
      updatedAt: Date.now(),
    });

    // Patch any group links referencing the old code
    const links = await ctx.db
      .query("stickerGroupLinks")
      .filter((q) => q.eq(q.field("stickerCode"), OLD))
      .collect();

    for (const link of links) {
      await ctx.db.patch(link._id, { stickerCode: NEW });
    }

    return { updated: true, oldCode: OLD, newCode: NEW, newName, linksPatched: links.length };
  },
});

export const deleteSticker = mutation({
  args: { id: v.id("stickers") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return { deleted: true };
  },
});
