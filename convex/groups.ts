import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGroupsBySubcategory = query({
  args: {
    subcategoryCode: v.string(),
    onlyActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const subcategoryCode = args.subcategoryCode.trim().toUpperCase();

    const results = await ctx.db
      .query("groups")
      .withIndex("by_subcategory", (q) =>
        q.eq("subcategoryCode", subcategoryCode)
      )
      .collect();

    return args.onlyActive
      ? results.filter((g) => g.isActive)
      : results;
  },
});