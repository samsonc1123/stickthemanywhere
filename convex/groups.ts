// convex/groups.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGroupsBySubcategory = query({
  args: {
    subcategoryCode: v.string(),
    onlyActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("groups")
      .withIndex("by_subcategory", (q) =>
        q.eq("subcategoryCode", args.subcategoryCode)
      )
      .collect();

    return args.onlyActive
      ? results.filter((g) => g.isActive)
      : results;
  },
});
