import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getMyRole = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    if (!sessionId) return null;
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_session_id", q => q.eq("sessionId", sessionId))
      .first();
    if (!session || Date.now() > session.expiresAt) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", session.email))
      .first();
    return (user as any)?.role ?? null;
  },
});

export const bootstrapAdmin = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    if (!sessionId) throw new Error("Not authenticated");

    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_session_id", q => q.eq("sessionId", sessionId))
      .first();
    if (!session || Date.now() > session.expiresAt) throw new Error("Session expired");

    const email = session.email;
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", email))
      .first();

    if (!user) {
      await ctx.db.insert("users", { email, role: "admin" });
      return { status: "created_admin", email };
    }

    if ((user as any).role === "admin") {
      return { status: "already_admin", email };
    }

    await ctx.db.patch(user._id, { role: "admin" } as any);
    return { status: "upgraded", email };
  },
});
