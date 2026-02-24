// convex/groups.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGroupsBySubcategory = query({
  args: {
    subcategoryCode: v.string(),
    onlyActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("groups")
      .withIndex("by_subcategory", (q) => q.eq("subcategoryCode", args.subcategoryCode));
    
    const results = await q.collect();
    
    const unique = new Map();
    for (const g of results) {
      // Normalize to UPPERCASE and HYPHENS
      const normalizedCode = g.code.toUpperCase().replace(/_/g, '-');
      if (!unique.has(normalizedCode)) {
        unique.set(normalizedCode, g);
      }
    }
    
    let filtered = Array.from(unique.values());
    if (args.onlyActive) {
      filtered = filtered.filter((g) => g.isActive);
    }
    return filtered;
  },
});
