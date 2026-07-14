import { query } from "./_generated/server";

// Simple ping — returns a value when Convex is connected
export const getIdentity = query({
  args: {},
  handler: async (_ctx) => {
    return { connected: true, ts: Date.now() };
  },
});
