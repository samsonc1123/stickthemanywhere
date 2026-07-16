// convex/subcategories.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const deleteSubcategoryByCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const rows = await ctx.db
      .query("subcategories")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { deleted: rows.length };
  },
});

export const getSubcategoryByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const results = await ctx.db
      .query("subcategories")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();
    return results ?? null;
  },
});

export const getAllSubcategories = query({
  handler: async (ctx) => {
    const results = await ctx.db.query("subcategories").collect();
    return results.sort((a, b) => {
      const catCmp = a.categoryCode.localeCompare(b.categoryCode);
      if (catCmp !== 0) return catCmp;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  },
});

export const getSubcategoriesByCategory = query({
  args: {
    categoryCode: v.string(),
    onlyActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("subcategories")
      .withIndex("by_category", (q) => q.eq("categoryCode", args.categoryCode));
    
    const results = await q.collect();
    
    let filtered = results;
    if (args.onlyActive) {
      filtered = filtered.filter((s) => s.isActive === true);
    }

    return filtered.sort((a, b) => {
      const sortA = a.sortOrder ?? 0;
      const sortB = b.sortOrder ?? 0;
      if (sortA !== sortB) return sortA - sortB;
      return a.code.localeCompare(b.code);
    });
  },
});
