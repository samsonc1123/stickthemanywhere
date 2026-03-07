// convex/groups.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGroupsBySubcategory = query({
  args: {
    subcategoryCode: v.string(),
    onlyActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const stickers = await ctx.db
      .query("stickers")
      .withIndex("by_subcategory", (q) =>
        q.eq("subcategoryCode", args.subcategoryCode)
      )
      .collect();

    const stickerCodes = new Set(stickers.map((s) => s.code));

    const links = await ctx.db.query("stickerGroupLinks").collect();

    const groupCodes = new Set<string>();
    for (const link of links) {
      if (stickerCodes.has(link.stickerCode)) {
        groupCodes.add(link.groupCode);
      }
    }

    const groups = await ctx.db.query("groups").collect();

    const results = groups.filter((g) => groupCodes.has(g.code));

    return args.onlyActive
      ? results.filter((g) => g.isActive)
      : results;
  },
});