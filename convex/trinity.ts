// convex/trinity.ts
//
// Trinity Brand — Frequency Sync Layer.
// Products are tagged by Spiritual Domain via taxonomy.
// syncAtmosphere ensures all devices in a room lock to the same Hz.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Shared validators ────────────────────────────────────────────────────────

const functionValidator = v.union(
  v.literal("relief"),
  v.literal("alignment"),
  v.literal("geometric"),
);

const deviceStateValidator = v.object({
  synced:      v.boolean(),
  frequencyHz: v.number(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * All active Trinity products, optionally filtered by function or domain.
 * Sorted by frequencyHz ascending.
 */
export const getProducts = query({
  args: {
    function:   v.optional(functionValidator),
    taxonomyId: v.optional(v.id("taxonomy")),
  },
  handler: async (ctx, args) => {
    let products = await ctx.db
      .query("trinityProducts")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (args.function) {
      products = products.filter((p) => p.function === args.function);
    }
    if (args.taxonomyId) {
      products = products.filter((p) => p.taxonomyId === args.taxonomyId);
    }

    // Attach taxonomy domain name for UI display
    return Promise.all(
      products
        .sort((a, b) => a.frequencyHz - b.frequencyHz)
        .map(async (p) => {
          const domain = p.taxonomyId ? await ctx.db.get(p.taxonomyId) : null;
          return {
            ...p,
            domain: domain
              ? { id: domain._id, name: domain.name, slug: domain.slug }
              : null,
          };
        })
    );
  },
});

/**
 * Get the current sync state of an atmosphere room.
 */
export const getRoomState = query({
  args: { roomId: v.id("atmosphereRooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    const product = room.trinityProductId
      ? await ctx.db.get(room.trinityProductId)
      : null;

    return {
      ...room,
      linkedProduct: product ?? null,
      allDevicesSynced:
        room.devices.pacifier.synced &&
        room.devices.mattress.synced &&
        room.devices.lighting.synced,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Sync all devices in a room to a single Hz frequency sourced from the
 * GAB vault (the linked Trinity product).
 *
 * Logic:
 *   1. Load the room record.
 *   2. If a trinityProductId is linked, pull its frequencyHz as the
 *      authoritative value. Otherwise use the room's current activeFrequencyHz.
 *   3. Set pacifier, mattress, and lighting all to that frequency
 *      with synced: true.
 *   4. Write the updated device block and lastSyncedAt timestamp.
 *
 * Returns { roomId, frequencyHz, devices, syncedAt }.
 */
export const syncAtmosphere = mutation({
  args: {
    roomId:           v.id("atmosphereRooms"),
    overrideFrequencyHz: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error(`Room ${args.roomId} not found`);

    // Resolve frequency: manual override → linked product → room default
    let frequencyHz = args.overrideFrequencyHz ?? room.activeFrequencyHz;

    if (!args.overrideFrequencyHz && room.trinityProductId) {
      const product = await ctx.db.get(room.trinityProductId);
      if (product && product.syncEnabled) {
        frequencyHz = product.frequencyHz;
      }
    }

    const syncedAt = Date.now();
    const syncedDevice = { synced: true, frequencyHz };

    await ctx.db.patch(args.roomId, {
      activeFrequencyHz: frequencyHz,
      devices: {
        pacifier: syncedDevice,
        mattress: syncedDevice,
        lighting: syncedDevice,
      },
      lastSyncedAt: syncedAt,
      updatedAt:    syncedAt,
    });

    return {
      roomId:      args.roomId,
      frequencyHz,
      devices: {
        pacifier: syncedDevice,
        mattress: syncedDevice,
        lighting: syncedDevice,
      },
      syncedAt,
    };
  },
});

/**
 * Upsert a Trinity product. Idempotent on productName + function pair.
 * Returns { id, created: boolean }.
 */
export const upsertProduct = mutation({
  args: {
    productName:  v.string(),
    function:     functionValidator,
    frequencyHz:  v.number(),
    syncEnabled:  v.boolean(),
    taxonomyId:   v.optional(v.id("taxonomy")),
    notes:        v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("trinityProducts")
      .withIndex("by_function", (q) => q.eq("function", args.function))
      .filter((q) => q.eq(q.field("productName"), args.productName))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        frequencyHz: args.frequencyHz,
        syncEnabled: args.syncEnabled,
        taxonomyId:  args.taxonomyId,
        notes:       args.notes,
        updatedAt:   now,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("trinityProducts", {
      productName:  args.productName,
      function:     args.function,
      frequencyHz:  args.frequencyHz,
      syncEnabled:  args.syncEnabled,
      taxonomyId:   args.taxonomyId,
      notes:        args.notes,
      isActive:     true,
      createdAt:    now,
      updatedAt:    now,
    });

    return { id, created: true };
  },
});

/**
 * Create or update an atmosphere room.
 * On create, all devices default to unsynced at 432 Hz until syncAtmosphere runs.
 */
export const upsertRoom = mutation({
  args: {
    roomId:           v.optional(v.id("atmosphereRooms")),
    roomName:         v.string(),
    trinityProductId: v.optional(v.id("trinityProducts")),
    defaultFrequencyHz: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now      = Date.now();
    const defaultHz = args.defaultFrequencyHz ?? 432;

    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);
      if (!room) throw new Error(`Room ${args.roomId} not found`);

      await ctx.db.patch(args.roomId, {
        roomName:         args.roomName,
        trinityProductId: args.trinityProductId,
        updatedAt:        now,
      });
      return { id: args.roomId, created: false };
    }

    const unsynced = { synced: false, frequencyHz: defaultHz };
    const id = await ctx.db.insert("atmosphereRooms", {
      roomName:          args.roomName,
      activeFrequencyHz: defaultHz,
      trinityProductId:  args.trinityProductId,
      devices: {
        pacifier: unsynced,
        mattress: unsynced,
        lighting: unsynced,
      },
      isActive:  true,
      createdAt: now,
      updatedAt: now,
    });

    return { id, created: true };
  },
});

/**
 * Link a room to a different Trinity product (updates the GAB vault source).
 */
export const linkProductToRoom = mutation({
  args: {
    roomId:           v.id("atmosphereRooms"),
    trinityProductId: v.id("trinityProducts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.roomId, {
      trinityProductId: args.trinityProductId,
      updatedAt:        Date.now(),
    });
    return { roomId: args.roomId, trinityProductId: args.trinityProductId };
  },
});
