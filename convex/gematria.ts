// convex/gematria.ts
//
// Standard Gematria engine (Mispar Hechrachi).
// Each Hebrew letter maps to its traditional ordinal value.
// Final (sofit) forms are treated as equal to their base letter
// by default — pass `useFinalValues: true` to use extended finals
// (Kaf=500, Mem=600, Nun=700, Pe=800, Tzadi=900).

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Letter table ─────────────────────────────────────────────────────────────

const STANDARD: Record<string, number> = {
  // Standard 22 letters
  "\u05D0": 1,   // א  Aleph
  "\u05D1": 2,   // ב  Bet
  "\u05D2": 3,   // ג  Gimel
  "\u05D3": 4,   // ד  Dalet
  "\u05D4": 5,   // ה  He
  "\u05D5": 6,   // ו  Vav
  "\u05D6": 7,   // ז  Zayin
  "\u05D7": 8,   // ח  Het
  "\u05D8": 9,   // ט  Tet
  "\u05D9": 10,  // י  Yod
  "\u05DB": 20,  // כ  Kaf
  "\u05DC": 30,  // ל  Lamed
  "\u05DE": 40,  // מ  Mem
  "\u05E0": 50,  // נ  Nun
  "\u05E1": 60,  // ס  Samekh
  "\u05E2": 70,  // ע  Ayin
  "\u05E4": 80,  // פ  Pe
  "\u05E6": 90,  // צ  Tzadi
  "\u05E7": 100, // ק  Qof
  "\u05E8": 200, // ר  Resh
  "\u05E9": 300, // ש  Shin
  "\u05EA": 400, // ת  Tav
  // Final (sofit) forms — standard values (same as base)
  "\u05DA": 20,  // ך  Final Kaf
  "\u05DD": 40,  // ם  Final Mem
  "\u05DF": 50,  // ן  Final Nun
  "\u05E3": 80,  // ף  Final Pe
  "\u05E5": 90,  // ץ  Final Tzadi
};

const FINAL_EXTENDED: Record<string, number> = {
  "\u05DA": 500, // ך  Final Kaf
  "\u05DD": 600, // ם  Final Mem
  "\u05DF": 700, // ן  Final Nun
  "\u05E3": 800, // ף  Final Pe
  "\u05E5": 900, // ץ  Final Tzadi
};

// ─── Pure calculation (importable on client or server) ────────────────────────

export function calculateGematria(
  text: string,
  opts: { useFinalValues?: boolean } = {}
): number {
  const table = opts.useFinalValues
    ? { ...STANDARD, ...FINAL_EXTENDED }
    : STANDARD;

  let total = 0;
  for (const char of text) {
    total += table[char] ?? 0; // non-Hebrew characters contribute 0
  }
  return total;
}

/**
 * Reduce a gematria value to a single digit (Theosophical reduction).
 * e.g. 432 → 4+3+2 = 9
 */
export function reduceToDigit(n: number): number {
  while (n > 9) {
    n = String(n)
      .split("")
      .reduce((acc, d) => acc + Number(d), 0);
  }
  return n;
}

// ─── Convex mutation: calculate + write into taxonomy node ────────────────────

/**
 * Given a taxonomy node id and a Hebrew string:
 *   1. Calculates Standard Gematria value.
 *   2. Writes the value to `numericalWeight` on the node.
 *   3. Merges gematria detail into `metadata.gematria`.
 *
 * Returns the computed values without requiring a re-fetch.
 */
export const computeAndStore = mutation({
  args: {
    taxonomyId: v.id("taxonomy"),
    hebrewText: v.string(),
    useFinalValues: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.taxonomyId);
    if (!node) throw new Error(`Taxonomy node ${args.taxonomyId} not found`);

    const value = calculateGematria(args.hebrewText, {
      useFinalValues: args.useFinalValues ?? false,
    });
    const reduced = reduceToDigit(value);

    const gematriaBlock = {
      input: args.hebrewText,
      standard: value,
      reduced,
      usedFinalValues: args.useFinalValues ?? false,
      computedAt: Date.now(),
    };

    const existingMeta =
      typeof node.metadata === "object" && node.metadata !== null
        ? node.metadata
        : {};

    await ctx.db.patch(args.taxonomyId, {
      numericalWeight: value,
      metadata: { ...existingMeta, gematria: gematriaBlock },
      updatedAt: Date.now(),
    });

    return {
      taxonomyId: args.taxonomyId,
      hebrewText: args.hebrewText,
      standard: value,
      reduced,
    };
  },
});

// ─── Convex query: calculate without writing ──────────────────────────────────

/**
 * Pure read — calculate gematria for any Hebrew string on-demand.
 * Nothing is written to the database.
 */
export const calculate = query({
  args: {
    hebrewText: v.string(),
    useFinalValues: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const value = calculateGematria(args.hebrewText, {
      useFinalValues: args.useFinalValues ?? false,
    });
    return {
      input: args.hebrewText,
      standard: value,
      reduced: reduceToDigit(value),
    };
  },
});

/**
 * Fetch all taxonomy nodes at or above a given numericalWeight threshold.
 * Useful for querying nodes by frequency resonance range.
 */
export const getByNumericalWeight = query({
  args: {
    weight: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("taxonomy")
      .withIndex("by_numerical_weight", (q) =>
        q.eq("numericalWeight", args.weight)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});
