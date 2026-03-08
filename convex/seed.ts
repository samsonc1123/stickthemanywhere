// convex/seed.ts
import { mutation } from "./_generated/server";
import { normalizeTaxonomyCode } from "./lib/taxonomy";

async function upsertCategory(ctx: any, rawCode: string, name: string, sortOrder: number) {
  const code = normalizeTaxonomyCode(rawCode);
  const all = await ctx.db
    .query("categories")
    .withIndex("by_code", (q: any) => q.eq("code", code))
    .collect();
  if (all.length > 0) {
    await ctx.db.patch(all[0]._id, { name, isActive: true, sortOrder });
    for (let i = 1; i < all.length; i++) {
      await ctx.db.delete(all[i]._id);
    }
  } else {
    await ctx.db.insert("categories", { code, name, isActive: true, sortOrder });
  }
}

async function upsertSubcategory(ctx: any, rawCategoryCode: string, rawCode: string, name: string, sortOrder: number) {
  const categoryCode = normalizeTaxonomyCode(rawCategoryCode);
  const code = normalizeTaxonomyCode(rawCode);
  const all = await ctx.db
    .query("subcategories")
    .withIndex("by_category_code", (q: any) => q.eq("categoryCode", categoryCode).eq("code", code))
    .collect();
  if (all.length > 0) {
    await ctx.db.patch(all[0]._id, { name, isActive: true, sortOrder });
    for (let i = 1; i < all.length; i++) {
      await ctx.db.delete(all[i]._id);
    }
  } else {
    await ctx.db.insert("subcategories", { categoryCode, code, name, isActive: true, sortOrder });
  }
}

async function upsertGroup(ctx: any, rawSubcategoryCode: string, rawCode: string, name: string, sortOrder: number) {
  const subcategoryCode = normalizeTaxonomyCode(rawSubcategoryCode);
  const code = normalizeTaxonomyCode(rawCode);
  const all = await ctx.db
    .query("groups")
    .withIndex("by_subcategory_code", (q: any) => q.eq("subcategoryCode", subcategoryCode).eq("code", code))
    .collect();
  if (all.length > 0) {
    await ctx.db.patch(all[0]._id, { name, isActive: true, sortOrder });
    for (let i = 1; i < all.length; i++) {
      await ctx.db.delete(all[i]._id);
    }
  } else {
    await ctx.db.insert("groups", { subcategoryCode, code, name, isActive: true, sortOrder });
  }
}

export const seedAllCategories = mutation({
  handler: async (ctx) => {
    await upsertCategory(ctx, "CHRISTIAN", "Christian", 1);
    await upsertCategory(ctx, "GAMING", "Gaming", 2);
    await upsertCategory(ctx, "SPORTS", "Sports", 3);
    await upsertCategory(ctx, "FOOD-DRINK", "Food & Drink", 4);
    await upsertCategory(ctx, "ANIME", "Anime", 5);
    await upsertCategory(ctx, "HISPANIC", "Hispanic", 6);
    await upsertCategory(ctx, "DISNEY", "Disney", 7);
    await upsertCategory(ctx, "ANIMATED-SERIES", "Animated Series", 8);
    await upsertCategory(ctx, "ANIMALS", "Animals", 9);
    await upsertCategory(ctx, "DRAGONS", "Dragons", 10);
    await upsertCategory(ctx, "UNICORNS", "Unicorns", 11);
    await upsertCategory(ctx, "HELLO-KITTY", "Hello Kitty", 12);
    await upsertCategory(ctx, "KAWAII", "Kawaii", 13);
    await upsertCategory(ctx, "TRIP", "Trippy", 14);
    await upsertCategory(ctx, "TRUMP", "Trump", 15);
    await upsertCategory(ctx, "MARIJUANA", "Marijuana", 16);
    await upsertCategory(ctx, "FLORAL", "Floral", 17);
    await upsertCategory(ctx, "FLOWERS", "Flowers", 18);
    await upsertCategory(ctx, "CARS", "Cars", 19);
    await upsertCategory(ctx, "MARIO", "Mario", 20);
    await upsertCategory(ctx, "MOVIES", "Movies", 21);
    await upsertCategory(ctx, "MEMES", "Memes", 22);
    await upsertCategory(ctx, "FASHION", "Fashion", 23);
    await upsertCategory(ctx, "FLORA-FAUNA", "Flora & Fauna", 24);

    await upsertSubcategory(ctx, "CHRISTIAN", "KJ", "King Jesus", 1);
    await upsertSubcategory(ctx, "CHRISTIAN", "GOD", "God The Father", 2);
    await upsertSubcategory(ctx, "CHRISTIAN", "HS", "Holy Spirit", 3);
    await upsertSubcategory(ctx, "CHRISTIAN", "SCR", "Scripture", 4);
    await upsertSubcategory(ctx, "CHRISTIAN", "CRS", "Crosses", 5);
    await upsertSubcategory(ctx, "CHRISTIAN", "HRT", "Hearts", 6);

    await upsertSubcategory(ctx, "GAMING", "MAR", "Mario", 1);
    await upsertSubcategory(ctx, "GAMING", "SON", "Sonic", 2);
    await upsertSubcategory(ctx, "GAMING", "DND", "D & D", 3);
    await upsertSubcategory(ctx, "GAMING", "ZEL", "Zelda", 4);
    await upsertSubcategory(ctx, "GAMING", "MAS", "Mashups", 5);
    await upsertSubcategory(ctx, "GAMING", "MCR", "Minecraft", 6);
    await upsertSubcategory(ctx, "GAMING", "ROB", "Roblox", 7);
    await upsertSubcategory(ctx, "GAMING", "PKM", "Pokemon", 8);
    await upsertSubcategory(ctx, "GAMING", "FOR", "Fortnite", 9);
    await upsertSubcategory(ctx, "GAMING", "AUS", "Among Us", 10);
    await upsertSubcategory(ctx, "GAMING", "FLG", "Fall Guys", 11);

    await upsertSubcategory(ctx, "SPORTS", "SOC", "Soccer", 1);
    await upsertSubcategory(ctx, "SPORTS", "HOC", "Hockey", 2);
    await upsertSubcategory(ctx, "SPORTS", "BAS", "Baseball", 3);
    await upsertSubcategory(ctx, "SPORTS", "FOO", "Football", 4);
    await upsertSubcategory(ctx, "SPORTS", "VOL", "Volleyball", 5);
    await upsertSubcategory(ctx, "SPORTS", "BOX", "Boxing", 6);
    await upsertSubcategory(ctx, "SPORTS", "OLY", "Olympics", 7);

    await upsertSubcategory(ctx, "FOOD-DRINK", "SUS", "Sushi", 1);
    await upsertSubcategory(ctx, "FOOD-DRINK", "PHO", "Pho", 2);
    await upsertSubcategory(ctx, "FOOD-DRINK", "PIZ", "Pizza", 3);
    await upsertSubcategory(ctx, "FOOD-DRINK", "BUR", "Burgers", 4);
    await upsertSubcategory(ctx, "FOOD-DRINK", "SWE", "Sweets", 5);
    await upsertSubcategory(ctx, "FOOD-DRINK", "COF", "Coffee", 6);
    await upsertSubcategory(ctx, "FOOD-DRINK", "BOB", "Boba", 7);

    await upsertSubcategory(ctx, "DISNEY", "FRZ", "Frozen", 1);
    await upsertSubcategory(ctx, "DISNEY", "TLK", "The Lion King", 2);
    await upsertSubcategory(ctx, "DISNEY", "TOY", "Toy Story", 3);
    await upsertSubcategory(ctx, "DISNEY", "MOA", "Moana", 4);
    await upsertSubcategory(ctx, "DISNEY", "ENC", "Encanto", 5);
    await upsertSubcategory(ctx, "DISNEY", "TNG", "Tangled", 6);
    await upsertSubcategory(ctx, "DISNEY", "FNM", "Finding Nemo", 7);
    await upsertSubcategory(ctx, "DISNEY", "MON", "Monsters Inc", 8);
    await upsertSubcategory(ctx, "DISNEY", "TLM", "The Little Mermaid", 9);
    await upsertSubcategory(ctx, "DISNEY", "MKF", "Mickey & Friends", 10);
    await upsertSubcategory(ctx, "DISNEY", "WTP", "Winnie the Pooh", 11);
    await upsertSubcategory(ctx, "DISNEY", "CND", "Cinderella", 12);
    await upsertSubcategory(ctx, "DISNEY", "BTB", "Beauty & the Beast", 13);
    await upsertSubcategory(ctx, "DISNEY", "DS", "Stitch", 14);

    await upsertSubcategory(ctx, "ANIMATED-SERIES", "ADV", "Adventure Time", 1);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "BAB", "Beavis and Butthead", 2);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "BOB", "Bob's Burgers", 3);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "BOD", "Boondocks", 4);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "FGY", "Family Guy", 5);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "FUT", "Futurama", 6);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "KOH", "King of the Hill", 7);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "REG", "Regular Show", 8);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "RAM", "Rick and Morty", 9);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "SIM", "Simpsons", 10);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "SPA", "South Park", 11);
    await upsertSubcategory(ctx, "ANIMATED-SERIES", "STU", "Steven Universe", 12);

    await upsertSubcategory(ctx, "ANIMALS", "AXO", "Axolotls", 1);
    await upsertSubcategory(ctx, "ANIMALS", "BRD", "Birds", 2);
    await upsertSubcategory(ctx, "ANIMALS", "BTF", "Butterflys", 3);
    await upsertSubcategory(ctx, "ANIMALS", "CAT", "Cats", 4);
    await upsertSubcategory(ctx, "ANIMALS", "DOG", "Dogs", 5);
    await upsertSubcategory(ctx, "ANIMALS", "ELE", "Elephants", 6);
    await upsertSubcategory(ctx, "ANIMALS", "LIO", "Lions", 7);
    await upsertSubcategory(ctx, "ANIMALS", "PAN", "Pandas", 8);
    await upsertSubcategory(ctx, "ANIMALS", "SHL", "Shellfish", 9);
    await upsertSubcategory(ctx, "ANIMALS", "SHK", "Sharks", 10);
    await upsertSubcategory(ctx, "ANIMALS", "TIG", "Tigers", 11);
    await upsertSubcategory(ctx, "ANIMALS", "TUR", "Turtles", 12);

    await upsertSubcategory(ctx, "DRAGONS", "DRG", "All", 1);
    await upsertSubcategory(ctx, "DRAGONS", "DRG-FIR", "Fire", 2);
    await upsertSubcategory(ctx, "DRAGONS", "DRG-ICE", "Ice", 3);
    await upsertSubcategory(ctx, "DRAGONS", "DRG-FAN", "Fantasy", 4);

    await upsertSubcategory(ctx, "UNICORNS", "UNI", "Rainbow", 1);

    await upsertSubcategory(ctx, "HELLO-KITTY", "HK-MAIN", "Hello Kitty", 1);
    await upsertSubcategory(ctx, "HELLO-KITTY", "HK-MM", "My Melody", 2);
    await upsertSubcategory(ctx, "HELLO-KITTY", "HK-KU", "Kuromi", 3);
    await upsertSubcategory(ctx, "HELLO-KITTY", "HK-CI", "Cinnamoroll", 4);
    await upsertSubcategory(ctx, "HELLO-KITTY", "HK-PN", "Pompompurin", 5);
    await upsertSubcategory(ctx, "HELLO-KITTY", "HK-KT", "Keroppi", 6);

    await upsertSubcategory(ctx, "TRIP", "MUSHROOMS", "Mushrooms", 1);
    await upsertSubcategory(ctx, "TRIP", "FROGS", "Frogs", 2);
    await upsertSubcategory(ctx, "TRIP", "TRIP-ANIMALS", "Animals", 3);
    await upsertSubcategory(ctx, "TRIP", "ALIENS", "Aliens", 4);
    await upsertSubcategory(ctx, "TRIP", "WORDS", "Words", 5);
    await upsertSubcategory(ctx, "TRIP", "CIRCLES", "Circles", 6);
    await upsertSubcategory(ctx, "TRIP", "SQUARES", "Squares", 7);

    await upsertSubcategory(ctx, "TRUMP", "MAG", "MAGA", 1);
    await upsertSubcategory(ctx, "TRUMP", "TRP", "Trump", 2);
    await upsertSubcategory(ctx, "TRUMP", "PAT", "Patriotic", 3);
    await upsertSubcategory(ctx, "TRUMP", "CON", "Conservative", 4);
    await upsertSubcategory(ctx, "TRUMP", "AMF", "American Flag", 5);
    await upsertSubcategory(ctx, "TRUMP", "REP", "Republican", 6);

    await upsertSubcategory(ctx, "HISPANIC", "SAY", "Sayings", 1);
    await upsertSubcategory(ctx, "HISPANIC", "ARG", "Argentina", 2);
    await upsertSubcategory(ctx, "HISPANIC", "BOL", "Bolivia", 3);
    await upsertSubcategory(ctx, "HISPANIC", "BRA", "Brazil", 4);
    await upsertSubcategory(ctx, "HISPANIC", "CHL", "Chile", 5);
    await upsertSubcategory(ctx, "HISPANIC", "COL", "Colombia", 6);
    await upsertSubcategory(ctx, "HISPANIC", "CRC", "Costa Rica", 7);
    await upsertSubcategory(ctx, "HISPANIC", "CUB", "Cuba", 8);
    await upsertSubcategory(ctx, "HISPANIC", "DOM", "Dominican Republic", 9);
    await upsertSubcategory(ctx, "HISPANIC", "ECU", "Ecuador", 10);
    await upsertSubcategory(ctx, "HISPANIC", "SLV", "El Salvador", 11);
    await upsertSubcategory(ctx, "HISPANIC", "GUA", "Guatemala", 12);
    await upsertSubcategory(ctx, "HISPANIC", "HON", "Honduras", 13);
    await upsertSubcategory(ctx, "HISPANIC", "MEX", "Mexico", 14);
    await upsertSubcategory(ctx, "HISPANIC", "NIC", "Nicaragua", 15);
    await upsertSubcategory(ctx, "HISPANIC", "PAN", "Panama", 16);
    await upsertSubcategory(ctx, "HISPANIC", "PRY", "Paraguay", 17);
    await upsertSubcategory(ctx, "HISPANIC", "PER", "Peru", 18);
    await upsertSubcategory(ctx, "HISPANIC", "PRC", "Puerto Rico", 19);
    await upsertSubcategory(ctx, "HISPANIC", "URY", "Uruguay", 20);
    await upsertSubcategory(ctx, "HISPANIC", "VEN", "Venezuela", 21);

    await upsertSubcategory(ctx, "MARIJUANA", "CANNABIS", "Cannabis", 1);

    await upsertSubcategory(ctx, "FLORAL", "WORDS-FLOWERS", "Words in Flowers", 1);
    await upsertSubcategory(ctx, "FLORAL", "FLOWERS-WORDS", "Flowers and Words", 2);
    await upsertSubcategory(ctx, "FLORAL", "FLOWERS-AROUND", "Flowers Around Words", 3);

    await upsertSubcategory(ctx, "FLOWERS", "FLO-ROS", "Roses", 1);
    await upsertSubcategory(ctx, "FLOWERS", "FLO-CAR", "Carnations", 2);
    await upsertSubcategory(ctx, "FLOWERS", "FLO-LIL", "Lilies", 3);
    await upsertSubcategory(ctx, "FLOWERS", "FLO-ORC", "Orchids", 4);
    await upsertSubcategory(ctx, "FLOWERS", "FLO-SUN", "Sunflowers", 5);
    await upsertSubcategory(ctx, "FLOWERS", "FLO-TUL", "Tulips", 6);
    await upsertSubcategory(ctx, "FLOWERS", "FLO-DAI", "Daisies", 7);
    await upsertSubcategory(ctx, "FLOWERS", "FLO-LOT", "Lotus", 8);
    await upsertSubcategory(ctx, "FLOWERS", "FLO-PEO", "Peonies", 9);

    await upsertSubcategory(ctx, "CARS", "CLASSIC", "Classic", 1);
    await upsertSubcategory(ctx, "CARS", "DIESEL", "Diesel", 2);
    await upsertSubcategory(ctx, "CARS", "DIRT-TRACK", "Dirt Track", 3);
    await upsertSubcategory(ctx, "CARS", "FANTASY", "Fantasy", 4);
    await upsertSubcategory(ctx, "CARS", "JEEPS", "Jeeps", 5);
    await upsertSubcategory(ctx, "CARS", "LUXURY", "Luxury", 6);
    await upsertSubcategory(ctx, "CARS", "MUSCLE", "Muscle", 7);
    await upsertSubcategory(ctx, "CARS", "PICK-UP", "Pick Up Trucks", 8);
    await upsertSubcategory(ctx, "CARS", "RACE", "Race", 9);
    await upsertSubcategory(ctx, "CARS", "SUVS", "SUVs", 10);
    await upsertSubcategory(ctx, "CARS", "SUPER-SPORTS", "Super Sports", 11);

    await upsertSubcategory(ctx, "MARIO", "MARIO-CHAR", "Mario", 1);
    await upsertSubcategory(ctx, "MARIO", "LUIGI", "Luigi", 2);
    await upsertSubcategory(ctx, "MARIO", "PEACH", "Princess Peach", 3);
    await upsertSubcategory(ctx, "MARIO", "YOSHI", "Yoshi", 4);
    await upsertSubcategory(ctx, "MARIO", "TOADSTOOL", "Toadstool", 5);
    await upsertSubcategory(ctx, "MARIO", "WARIO", "Wario", 6);
    await upsertSubcategory(ctx, "MARIO", "KOOPA", "King Koopa", 7);

    await upsertSubcategory(ctx, "MOVIES", "STAR-WARS", "Star Wars", 1);

    await upsertSubcategory(ctx, "MEMES", "KERMIT", "Kermit", 1);
    await upsertSubcategory(ctx, "MEMES", "MR-BEAN", "Mr. Bean", 2);
    await upsertSubcategory(ctx, "MEMES", "CARTOON-BABY", "Cartoon Baby", 3);
    await upsertSubcategory(ctx, "MEMES", "TROLL", "Troll Internet", 4);
    await upsertSubcategory(ctx, "MEMES", "GRUMPY-CAT", "Grumpy Cat", 5);
    await upsertSubcategory(ctx, "MEMES", "DRAKE", "Drake Meme", 6);
    await upsertSubcategory(ctx, "MEMES", "SPONGEBOB", "SpongeBob", 7);
    await upsertSubcategory(ctx, "MEMES", "DISTRACTED", "Distracted Boyfriend", 8);

    await upsertSubcategory(ctx, "FASHION", "FSH-BAP", "Bathing Ape", 1);
    await upsertSubcategory(ctx, "FASHION", "FSH-SUP", "Supreme", 2);
    await upsertSubcategory(ctx, "FASHION", "FSH-DC", "DC", 3);
    await upsertSubcategory(ctx, "FASHION", "FSH-SPI", "Spitfire", 4);
    await upsertSubcategory(ctx, "FASHION", "FSH-TOY", "Toy Machine", 5);
    await upsertSubcategory(ctx, "FASHION", "FSH-JOR", "Jordan", 6);
    await upsertSubcategory(ctx, "FASHION", "FSH-GUC", "Gucci", 7);
    await upsertSubcategory(ctx, "FASHION", "FSH-LV", "Louis Vuitton", 8);
    await upsertSubcategory(ctx, "FASHION", "FSH-NIK", "Nike", 9);
    await upsertSubcategory(ctx, "FASHION", "FSH-ADI", "Adidas", 10);
    await upsertSubcategory(ctx, "FASHION", "FSH-PAL", "Palace", 11);

    await upsertSubcategory(ctx, "FLORA-FAUNA", "FF-ROSES", "Roses", 1);
    await upsertSubcategory(ctx, "FLORA-FAUNA", "FF-ORCHIDS", "Orchids", 2);
    await upsertSubcategory(ctx, "FLORA-FAUNA", "FF-LILIES", "Lilies", 3);
    await upsertSubcategory(ctx, "FLORA-FAUNA", "FF-DAISIES", "Daisies", 4);
    await upsertSubcategory(ctx, "FLORA-FAUNA", "FF-HYDRANGEAS", "Hydrangeas", 5);
  },
});

async function upsertSticker(
  ctx: any,
  rawCode: string,
  name: string,
  rawCategoryCode: string,
  rawSubcategoryCode: string,
  sortOrder: number,
  filename: string,
  price: number,
) {
  const code = normalizeTaxonomyCode(rawCode);
  const categoryCode = normalizeTaxonomyCode(rawCategoryCode);
  const subcategoryCode = normalizeTaxonomyCode(rawSubcategoryCode);
  const existing = await ctx.db
    .query("stickers")
    .withIndex("by_code", (q: any) => q.eq("code", code))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { name, title: name, categoryCode, subcategoryCode, isActive: true, sortOrder, filename, price });
  } else {
    await ctx.db.insert("stickers", { code, name, title: name, isActive: true, categoryCode, subcategoryCode, sortOrder, filename, price });
  }
}

async function upsertStickerGroupLink(ctx: any, rawStickerCode: string, rawGroupCode: string) {
  const stickerCode = normalizeTaxonomyCode(rawStickerCode);
  const groupCode = normalizeTaxonomyCode(rawGroupCode);
  const existing = await ctx.db
    .query("stickerGroupLinks")
    .withIndex("by_group", (q: any) => q.eq("groupCode", groupCode))
    .filter((q: any) => q.eq(q.field("stickerCode"), stickerCode))
    .unique();
  if (!existing) {
    await ctx.db.insert("stickerGroupLinks", { stickerCode, groupCode });
  }
}

export const seedPokemonBase = mutation({
  handler: async (ctx) => {
    await upsertCategory(ctx, "POKEMON", "Pokémon", 25);

    await upsertSubcategory(ctx, "POKEMON", "POK-TYP", "Types", 1);
    await upsertSubcategory(ctx, "POKEMON", "POK-GEN", "Generations", 2);
    await upsertSubcategory(ctx, "POKEMON", "POK-LGD", "Legendaries", 3);

    const types = ["Normal", "Fire", "Water", "Grass", "Electric", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];
    for (let i = 0; i < types.length; i++) {
      await upsertGroup(ctx, "POK-TYP", types[i].toUpperCase(), types[i], i);
    }

    const gens = [
      { name: "Gen 1", code: "GEN-01" },
      { name: "Gen 2", code: "GEN-02" },
      { name: "Gen 3", code: "GEN-03" },
      { name: "Gen 4", code: "GEN-04" },
      { name: "Gen 5", code: "GEN-05" },
      { name: "Gen 6", code: "GEN-06" },
      { name: "Gen 7", code: "GEN-07" },
      { name: "Gen 8", code: "GEN-08" },
      { name: "Gen 9", code: "GEN-09" },
    ];
    for (let i = 0; i < gens.length; i++) {
      await upsertGroup(ctx, "POK-GEN", gens[i].code, gens[i].name, i);
    }

    const legendaries = [
      { name: "Legendary", code: "LEGENDARY" },
      { name: "Mythical", code: "MYTHICAL" },
      { name: "Ultra Beast", code: "ULTRA-BEAST" },
    ];
    for (let i = 0; i < legendaries.length; i++) {
      await upsertGroup(ctx, "POK-LGD", legendaries[i].code, legendaries[i].name, i);
    }

    const templateFilename = "bulbasaur_test.png";
    const templatePrice = 4.00;

    const genStickers = [
      { stickerCode: "POK-GEN-01", name: "Gen 1", groupCode: "GEN-01" },
      { stickerCode: "POK-GEN-02", name: "Gen 2", groupCode: "GEN-02" },
      { stickerCode: "POK-GEN-03", name: "Gen 3", groupCode: "GEN-03" },
      { stickerCode: "POK-GEN-04", name: "Gen 4", groupCode: "GEN-04" },
      { stickerCode: "POK-GEN-05", name: "Gen 5", groupCode: "GEN-05" },
      { stickerCode: "POK-GEN-06", name: "Gen 6", groupCode: "GEN-06" },
      { stickerCode: "POK-GEN-07", name: "Gen 7", groupCode: "GEN-07" },
      { stickerCode: "POK-GEN-08", name: "Gen 8", groupCode: "GEN-08" },
      { stickerCode: "POK-GEN-09", name: "Gen 9", groupCode: "GEN-09" },
    ];
    for (let i = 0; i < genStickers.length; i++) {
      const s = genStickers[i];
      await upsertSticker(ctx, s.stickerCode, s.name, "POKEMON", "POK-GEN", i, templateFilename, templatePrice);
      await upsertStickerGroupLink(ctx, s.stickerCode, s.groupCode);
    }

    const lgdStickers = [
      { stickerCode: "POK-LGD-01", name: "Legendary", groupCode: "LEGENDARY" },
      { stickerCode: "POK-LGD-02", name: "Mythical", groupCode: "MYTHICAL" },
      { stickerCode: "POK-LGD-03", name: "Ultra Beast", groupCode: "ULTRA-BEAST" },
    ];
    for (let i = 0; i < lgdStickers.length; i++) {
      const s = lgdStickers[i];
      await upsertSticker(ctx, s.stickerCode, s.name, "POKEMON", "POK-LGD", i, templateFilename, templatePrice);
      await upsertStickerGroupLink(ctx, s.stickerCode, s.groupCode);
    }
  },
});

// Links POK-TYP00001 (uploaded sticker) → FIRE group. Idempotent.
export const linkPokTypFireSticker = mutation({
  handler: async (ctx) => {
    const stickerCode = "POK-TYP00001";
    const groupCode = "FIRE";

    const existing = await ctx.db
      .query("stickerGroupLinks")
      .withIndex("by_sticker", (q: any) => q.eq("stickerCode", stickerCode))
      .collect();

    const alreadyLinked = existing.some((l: any) => l.groupCode === groupCode);
    if (alreadyLinked) {
      return { status: "already linked", stickerCode, groupCode };
    }

    await ctx.db.insert("stickerGroupLinks", {
      stickerCode,
      groupCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { status: "linked", stickerCode, groupCode };
  },
});

// ─── Tier 3 Canonical Test Pack ──────────────────────────────────────────────
// Purpose: validate 3-tier taxonomy end-to-end (category → subcategory → group)
// Safe to run in both Development and Production — fully idempotent.
//
// Tier 1 (Category):  POK  "Pokémon"
// Tier 2 (Subcategory): LEG  "Legendaries"
// Tier 3 (Groups):    MYTHICAL, ULTRA-BEAST, TRIOS
//   MYTHICAL    → 3 stickers (tests multiple stickers in one group)
//   ULTRA-BEAST → 2 stickers (tests group filtering)
//   TRIOS       → 0 stickers (tests empty group rendering)
// ─────────────────────────────────────────────────────────────────────────────
export const seedTier3TestPack = mutation({
  handler: async (ctx) => {
    // Tier 1 — Category
    await upsertCategory(ctx, "POK", "Pokémon", 26);

    // Tier 2 — Subcategory
    await upsertSubcategory(ctx, "POK", "LEG", "Legendaries", 1);

    // Tier 3 — Groups (one belongs to exactly one subcategory: LEG)
    await upsertGroup(ctx, "LEG", "MYTHICAL",    "Mythical",          1);
    await upsertGroup(ctx, "LEG", "ULTRA-BEAST", "Ultra Beast",       2);
    await upsertGroup(ctx, "LEG", "TRIOS",       "Legendary Trios",   3); // intentionally empty

    // Stickers — real content rows, not taxonomy placeholders
    // Three stickers in MYTHICAL (tests multiple stickers per group)
    await upsertSticker(ctx, "LEG-001", "Mew",      "POK", "LEG", 1, "LEG-001.png", 4.00);
    await upsertSticker(ctx, "LEG-002", "Celebi",   "POK", "LEG", 2, "LEG-002.png", 4.00);
    await upsertSticker(ctx, "LEG-003", "Jirachi",  "POK", "LEG", 3, "LEG-003.png", 4.00);

    // Two stickers in ULTRA-BEAST (tests group filtering)
    await upsertSticker(ctx, "LEG-004", "Buzzwole",   "POK", "LEG", 4, "LEG-004.png", 4.00);
    await upsertSticker(ctx, "LEG-005", "Pheromosa",  "POK", "LEG", 5, "LEG-005.png", 4.00);

    // stickerGroupLinks — wire stickers to their groups
    await upsertStickerGroupLink(ctx, "LEG-001", "MYTHICAL");
    await upsertStickerGroupLink(ctx, "LEG-002", "MYTHICAL");
    await upsertStickerGroupLink(ctx, "LEG-003", "MYTHICAL");
    await upsertStickerGroupLink(ctx, "LEG-004", "ULTRA-BEAST");
    await upsertStickerGroupLink(ctx, "LEG-005", "ULTRA-BEAST");
    // TRIOS has no links — empty group is the test case

    return {
      category:    "POK",
      subcategory: "LEG",
      groups:      ["MYTHICAL", "ULTRA-BEAST", "TRIOS"],
      stickers:    ["LEG-001", "LEG-002", "LEG-003", "LEG-004", "LEG-005"],
      links: [
        "LEG-001 → MYTHICAL",
        "LEG-002 → MYTHICAL",
        "LEG-003 → MYTHICAL",
        "LEG-004 → ULTRA-BEAST",
        "LEG-005 → ULTRA-BEAST",
        "TRIOS   → (empty)",
      ],
    };
  },
});
