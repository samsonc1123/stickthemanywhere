import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function makeHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export const sendMagicLink = action({
  args: { email: v.string(), siteUrl: v.string() },
  handler: async (ctx, { email, siteUrl }) => {
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = makeHex(tokenBytes);
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await ctx.runMutation(internal.magicAuth.storeToken, { email, token, expiresAt });

    const magicUrl = `${siteUrl}?token=${token}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "StickThemAnywhere <onboarding@resend.dev>",
        to: email,
        subject: "Admin Dugout — Sign In Link",
        html: `
          <div style="font-family:monospace;background:#000;color:#00ff41;padding:32px;max-width:480px;margin:0 auto;">
            <h2 style="color:#00ff41;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:24px;font-size:18px;">
              Admin Dugout
            </h2>
            <p style="color:#aaa;margin-bottom:8px;font-size:14px;">
              Your sign-in link is ready. It expires in 15 minutes.
            </p>
            <p style="color:#555;margin-bottom:24px;font-size:12px;">
              If you didn't request this, ignore this email.
            </p>
            <a href="${magicUrl}"
              style="display:inline-block;padding:14px 28px;background:#00ff41;color:#000;font-weight:bold;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;font-size:13px;">
              SIGN IN
            </a>
            <p style="color:#444;margin-top:28px;font-size:11px;word-break:break-all;">
              Or paste this link: ${magicUrl}
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Email send failed (${res.status}): ${body}`);
    }

    return { sent: true };
  },
});

export const storeToken = internalMutation({
  args: { email: v.string(), token: v.string(), expiresAt: v.number() },
  handler: async (ctx, { email, token, expiresAt }) => {
    await ctx.db.insert("magicTokens", { email, token, expiresAt, used: false });
  },
});

export const verifyToken = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const result = await ctx.runMutation(internal.magicAuth.consumeToken, { token });

    if (!result.ok) {
      return { success: false as const, error: result.error };
    }

    const sessionBytes = new Uint8Array(32);
    crypto.getRandomValues(sessionBytes);
    const sessionId = makeHex(sessionBytes);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.runMutation(internal.magicAuth.storeSession, {
      email: result.email,
      sessionId,
      expiresAt,
    });

    return { success: true as const, sessionId, email: result.email };
  },
});

export const consumeToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const record = await ctx.db
      .query("magicTokens")
      .withIndex("by_token", q => q.eq("token", token))
      .first();

    if (!record) return { ok: false as const, error: "Invalid link", email: "" };
    if (record.used) return { ok: false as const, error: "Link already used", email: "" };
    if (Date.now() > record.expiresAt) return { ok: false as const, error: "Link expired", email: "" };

    await ctx.db.patch(record._id, { used: true });
    return { ok: true as const, error: "", email: record.email };
  },
});

export const storeSession = internalMutation({
  args: { email: v.string(), sessionId: v.string(), expiresAt: v.number() },
  handler: async (ctx, { email, sessionId, expiresAt }) => {
    await ctx.db.insert("adminSessions", { email, sessionId, expiresAt });
  },
});

export const getSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    if (!sessionId) return null;
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_session_id", q => q.eq("sessionId", sessionId))
      .first();
    if (!session || Date.now() > session.expiresAt) return null;
    return { email: session.email, expiresAt: session.expiresAt };
  },
});

export const signOut = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_session_id", q => q.eq("sessionId", sessionId))
      .first();
    if (session) await ctx.db.delete(session._id);
    return { success: true };
  },
});
