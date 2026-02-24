// convex/cleanup.ts
import { mutation } from "./_generated/server";
import { normalizeTaxonomyCode } from "./lib/taxonomy";

const CANONICAL_CATEGORIES = new Set([
  "CHRISTIAN", "GAMING", "SPORTS", "FOOD-DRINK", "ANIME", "HISPANIC",
  "DISNEY", "ANIMATED-SERIES", "ANIMALS", "DRAGONS", "UNICORNS",
  "HELLO-KITTY", "KAWAII", "TRIP", "TRUMP", "POKEMON", "MARIJUANA",
  "FLORAL", "FLOWERS", "CARS", "MARIO", "MOVIES", "MEMES", "FASHION",
  "FLORA-FAUNA",
]);

const CANONICAL_SUBCATEGORIES: Record<string, Set<string>> = {
  CHRISTIAN: new Set(["KJ", "GOD", "HS", "SCR", "CRS", "HRT"]),
  GAMING: new Set(["MAR", "SON", "DND", "ZEL", "MAS", "MCR", "ROB", "PKM", "FOR", "AUS", "FLG"]),
  SPORTS: new Set(["SOC", "HOC", "BAS", "FOO", "VOL", "BOX", "OLY"]),
  "FOOD-DRINK": new Set(["SUS", "PHO", "PIZ", "BUR", "SWE", "COF", "BOB"]),
  DISNEY: new Set(["FRZ", "TLK", "TOY", "MOA", "ENC", "TNG", "FNM", "MON", "TLM", "MKF", "WTP", "CND", "BTB", "DS"]),
  "ANIMATED-SERIES": new Set(["ADV", "BAB", "BOB", "BOD", "FGY", "FUT", "KOH", "REG", "RAM", "SIM", "SPA", "STU"]),
  ANIMALS: new Set(["AXO", "BRD", "BTF", "CAT", "DOG", "ELE", "LIO", "PAN", "SHL", "SHK", "TIG", "TUR"]),
  DRAGONS: new Set(["DRG", "DRG-FIR", "DRG-ICE", "DRG-FAN"]),
  UNICORNS: new Set(["UNI"]),
  "HELLO-KITTY": new Set(["HK-MAIN", "HK-MM", "HK-KU", "HK-CI", "HK-PN", "HK-KT"]),
  TRIP: new Set(["MUSHROOMS", "FROGS", "TRIP-ANIMALS", "ALIENS", "WORDS", "CIRCLES", "SQUARES"]),
  TRUMP: new Set(["MAG", "TRP", "PAT", "CON", "AMF", "REP"]),
  HISPANIC: new Set(["SAY", "ARG", "BOL", "BRA", "CHL", "COL", "CRC", "CUB", "DOM", "ECU", "SLV", "GUA", "HON", "MEX", "NIC", "PAN", "PRY", "PER", "PRC", "URY", "VEN"]),
  MARIJUANA: new Set(["CANNABIS"]),
  FLORAL: new Set(["WORDS-FLOWERS", "FLOWERS-WORDS", "FLOWERS-AROUND"]),
  FLOWERS: new Set(["FLO-ROS", "FLO-CAR", "FLO-LIL", "FLO-ORC", "FLO-SUN", "FLO-TUL", "FLO-DAI", "FLO-LOT", "FLO-PEO"]),
  CARS: new Set(["CLASSIC", "DIESEL", "DIRT-TRACK", "FANTASY", "JEEPS", "LUXURY", "MUSCLE", "PICK-UP", "RACE", "SUVS", "SUPER-SPORTS"]),
  MARIO: new Set(["MARIO-CHAR", "LUIGI", "PEACH", "YOSHI", "TOADSTOOL", "WARIO", "KOOPA"]),
  MOVIES: new Set(["STAR-WARS"]),
  MEMES: new Set(["KERMIT", "MR-BEAN", "CARTOON-BABY", "TROLL", "GRUMPY-CAT", "DRAKE", "SPONGEBOB", "DISTRACTED"]),
  FASHION: new Set(["FSH-BAP", "FSH-SUP", "FSH-DC", "FSH-SPI", "FSH-TOY", "FSH-JOR", "FSH-GUC", "FSH-LV", "FSH-NIK", "FSH-ADI", "FSH-PAL"]),
  "FLORA-FAUNA": new Set(["FF-ROSES", "FF-ORCHIDS", "FF-LILIES", "FF-DAISIES", "FF-HYDRANGEAS"]),
  POKEMON: new Set(["POK-TYP", "POK-GEN", "POK-LGD"]),
};

const CANONICAL_GROUPS: Record<string, Set<string>> = {
  "POK-TYP": new Set(["NORMAL", "FIRE", "WATER", "GRASS", "ELECTRIC", "ICE", "FIGHTING", "POISON", "GROUND", "FLYING", "PSYCHIC", "BUG", "ROCK", "GHOST", "DRAGON", "DARK", "STEEL", "FAIRY"]),
  "POK-GEN": new Set(["GEN-01", "GEN-02", "GEN-03", "GEN-04", "GEN-05", "GEN-06", "GEN-07", "GEN-08", "GEN-09"]),
  "POK-LGD": new Set(["LEGENDARY", "MYTHICAL", "ULTRA-BEAST"]),
};

export const removeDuplicateGroups = mutation({
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    let totalDeleted = 0;

    for (const subCode of Object.keys(CANONICAL_GROUPS)) {
      const subGroups = groups.filter(g => g.subcategoryCode === subCode);
      const seen = new Set<string>();

      for (const group of subGroups) {
        if (seen.has(group.code)) {
          await ctx.db.delete(group._id);
          totalDeleted++;
        } else {
          seen.add(group.code);
        }
      }
    }

    return { deletedCount: totalDeleted };
  },
});

export const removeDuplicateSubcategories = mutation({
  handler: async (ctx) => {
    const subcats = await ctx.db.query("subcategories").collect();
    let totalDeleted = 0;

    for (const catCode of Object.keys(CANONICAL_SUBCATEGORIES)) {
      const catSubs = subcats.filter(s => s.categoryCode === catCode);
      const seen = new Set<string>();

      for (const sub of catSubs) {
        if (seen.has(sub.code)) {
          await ctx.db.delete(sub._id);
          totalDeleted++;
        } else {
          seen.add(sub.code);
        }
      }
    }

    return { deletedCount: totalDeleted };
  },
});

export const removeDuplicateCategories = mutation({
  handler: async (ctx) => {
    const cats = await ctx.db.query("categories").collect();
    const seen = new Set<string>();
    let totalDeleted = 0;

    for (const cat of cats) {
      if (seen.has(cat.code)) {
        await ctx.db.delete(cat._id);
        totalDeleted++;
      } else {
        seen.add(cat.code);
      }
    }

    return { deletedCount: totalDeleted };
  },
});

export const purgeNonCanonical = mutation({
  handler: async (ctx) => {
    let deletedGroups = 0;
    let deletedSubcats = 0;
    let deletedCats = 0;

    const groups = await ctx.db.query("groups").collect();
    for (const group of groups) {
      const allowed = CANONICAL_GROUPS[group.subcategoryCode];
      if (allowed && !allowed.has(group.code)) {
        await ctx.db.delete(group._id);
        deletedGroups++;
      }
    }

    const subcats = await ctx.db.query("subcategories").collect();
    for (const sub of subcats) {
      const allowed = CANONICAL_SUBCATEGORIES[sub.categoryCode];
      if (allowed && !allowed.has(sub.code)) {
        await ctx.db.delete(sub._id);
        deletedSubcats++;
      }
    }

    const cats = await ctx.db.query("categories").collect();
    for (const cat of cats) {
      if (!CANONICAL_CATEGORIES.has(cat.code)) {
        await ctx.db.delete(cat._id);
        deletedCats++;
      }
    }

    return { deletedGroups, deletedSubcats, deletedCats };
  },
});

export const cleanupTaxonomy = mutation({
  handler: async (ctx) => {
    const results = {
      groupsProcessed: 0,
      groupsMerged: 0,
      linksMigrated: 0,
      stickersUpdated: 0,
    };

    const allGroups = await ctx.db.query("groups").collect();
    const canonicalGroups = new Map();

    for (const group of allGroups) {
      const canonicalCode = group.code.toUpperCase().replace(/_/g, "-");
      const key = `${group.subcategoryCode}:${canonicalCode}`;

      if (!canonicalGroups.has(key)) {
        if (group.code !== canonicalCode) {
          await ctx.db.patch(group._id, { code: canonicalCode });
        }
        canonicalGroups.set(key, group._id);
        results.groupsProcessed++;
      } else {
        const canonicalId = canonicalGroups.get(key);
        
        // Migrate links
        const links = await ctx.db
          .query("stickerGroupLinks")
          .withIndex("by_group", (q) => q.eq("groupCode", group.code))
          .collect();
        for (const link of links) {
          await ctx.db.patch(link._id, { groupCode: canonicalCode });
          results.linksMigrated++;
        }

        // Migrate stickers (if any direct references exist)
        const stickers = await ctx.db
          .query("stickers")
          .filter((q) => q.eq(q.field("subcategoryCode"), group.subcategoryCode))
          .collect();
        for (const sticker of stickers) {
          if (sticker.code && sticker.code.includes(group.code)) {
             // This is a heuristic, but stickers usually follow the group/sub prefix
             const newStickerCode = sticker.code.replace(group.code, canonicalCode);
             if (newStickerCode !== sticker.code) {
               await ctx.db.patch(sticker._id, { code: newStickerCode });
               results.stickersUpdated++;
             }
          }
        }

        await ctx.db.delete(group._id);
        results.groupsMerged++;
      }
    }

    return results;
  },
});

export const migrateGroupLinks = mutation({
  handler: async (ctx) => {
    const CODE_MAP: Record<string, string> = {
      "TYP-NORMAL": "NORMAL", "TYP-FIRE": "FIRE", "TYP-WATER": "WATER",
      "TYP-GRASS": "GRASS", "TYP-ELECTRIC": "ELECTRIC", "TYP-ICE": "ICE",
      "TYP-FIGHTING": "FIGHTING", "TYP-POISON": "POISON", "TYP-GROUND": "GROUND",
      "TYP-FLYING": "FLYING", "TYP-PSYCHIC": "PSYCHIC", "TYP-BUG": "BUG",
      "TYP-ROCK": "ROCK", "TYP-GHOST": "GHOST", "TYP-DRAGON": "DRAGON",
      "TYP-DARK": "DARK", "TYP-STEEL": "STEEL", "TYP-FAIRY": "FAIRY",
      "LGD-LEG": "LEGENDARY", "LGD-MYT": "MYTHICAL", "LGD-UBT": "ULTRA-BEAST",
      "ULTRA_BEAST": "ULTRA-BEAST",
    };

    const links = await ctx.db.query("stickerGroupLinks").collect();
    let migrated = 0;

    for (const link of links) {
      const mapped = CODE_MAP[link.groupCode];
      if (mapped) {
        await ctx.db.patch(link._id, { groupCode: normalizeTaxonomyCode(mapped) });
        migrated++;
      } else {
        const normalized = normalizeTaxonomyCode(link.groupCode);
        if (normalized !== link.groupCode) {
          await ctx.db.patch(link._id, { groupCode: normalized });
          migrated++;
        }
      }
    }

    return { migrated };
  },
});
