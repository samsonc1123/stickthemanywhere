import { mutation, query } from "./_generated/server";

const CATEGORIES: { code: string; name: string; icon?: string; sortOrder: number }[] = [
  { code: "ANIMALS",          name: "Animals",          icon: "🐾", sortOrder: 1 },
  { code: "ANIME",            name: "Anime",            icon: "⛩️", sortOrder: 2 },
  { code: "ANIMATED-SERIES",  name: "Animated Series",  icon: "📺", sortOrder: 3 },
  { code: "CARS",             name: "Cars",             icon: "🚗", sortOrder: 4 },
  { code: "CHRISTIAN",        name: "Christian",        icon: "✝️", sortOrder: 5 },
  { code: "DISNEY",           name: "Disney",           icon: "🏰", sortOrder: 6 },
  { code: "DRAGONS",          name: "Dragons",          icon: "🐉", sortOrder: 7 },
  { code: "FASHION",          name: "Fashion",          icon: "👗", sortOrder: 8 },
  { code: "FLORAL",           name: "Floral",           icon: "🌸", sortOrder: 9 },
  { code: "FLORA-FAUNA",      name: "Flora & Fauna",    icon: "🌿", sortOrder: 10 },
  { code: "FLOWERS",          name: "Flowers",          icon: "🌺", sortOrder: 11 },
  { code: "FOOD-DRINK",       name: "Food & Drink",     icon: "🍜", sortOrder: 12 },
  { code: "GAMING",           name: "Gaming",           icon: "🎮", sortOrder: 13 },
  { code: "HELLO-KITTY",      name: "Hello Kitty",      icon: "🎀", sortOrder: 14 },
  { code: "HISPANIC",         name: "Hispanic",         icon: "🌎", sortOrder: 15 },
  { code: "KAWAII",           name: "Kawaii",           icon: "🌟", sortOrder: 16 },
  { code: "MARIO",            name: "Mario",            icon: "🍄", sortOrder: 17 },
  { code: "MARIJUANA",        name: "Marijuana",        icon: "🌿", sortOrder: 18 },
  { code: "MEMES",            name: "Memes",            icon: "😂", sortOrder: 19 },
  { code: "MOVIES",           name: "Movies",           icon: "🎬", sortOrder: 20 },
  { code: "POKEMON",          name: "Pokémon",          icon: "⚡", sortOrder: 21 },
  { code: "SPORTS",           name: "Sports",           icon: "⚽", sortOrder: 22 },
  { code: "TRIP",             name: "Trip",             icon: "🍄", sortOrder: 23 },
  { code: "TRUMP",            name: "Trump",            icon: "🦅", sortOrder: 24 },
  { code: "UNICORNS",         name: "Unicorns",         icon: "🦄", sortOrder: 25 },
];

const SUBCATEGORIES: { categoryCode: string; code: string; name: string; sortOrder: number }[] = [
  // ANIMALS
  { categoryCode: "ANIMALS", code: "AXO", name: "Axolotl",    sortOrder: 1 },
  { categoryCode: "ANIMALS", code: "BRD", name: "Birds",      sortOrder: 2 },
  { categoryCode: "ANIMALS", code: "BTF", name: "Butterflies",sortOrder: 3 },
  { categoryCode: "ANIMALS", code: "CAT", name: "Cats",       sortOrder: 4 },
  { categoryCode: "ANIMALS", code: "DOG", name: "Dogs",       sortOrder: 5 },
  { categoryCode: "ANIMALS", code: "ELE", name: "Elephants",  sortOrder: 6 },
  { categoryCode: "ANIMALS", code: "LIO", name: "Lions",      sortOrder: 7 },
  { categoryCode: "ANIMALS", code: "PAN", name: "Pandas",     sortOrder: 8 },
  { categoryCode: "ANIMALS", code: "SHL", name: "Shells",     sortOrder: 9 },
  { categoryCode: "ANIMALS", code: "SHK", name: "Sharks",     sortOrder: 10 },
  { categoryCode: "ANIMALS", code: "TIG", name: "Tigers",     sortOrder: 11 },
  { categoryCode: "ANIMALS", code: "TUR", name: "Turtles",    sortOrder: 12 },

  // ANIMATED-SERIES
  { categoryCode: "ANIMATED-SERIES", code: "ADV", name: "Adventure Time",     sortOrder: 1 },
  { categoryCode: "ANIMATED-SERIES", code: "BAB", name: "Baby Shark",         sortOrder: 2 },
  { categoryCode: "ANIMATED-SERIES", code: "BOB", name: "Bob's Burgers",      sortOrder: 3 },
  { categoryCode: "ANIMATED-SERIES", code: "BOD", name: "Beavis & Butt-Head", sortOrder: 4 },
  { categoryCode: "ANIMATED-SERIES", code: "FGY", name: "Family Guy",         sortOrder: 5 },
  { categoryCode: "ANIMATED-SERIES", code: "FUT", name: "Futurama",           sortOrder: 6 },
  { categoryCode: "ANIMATED-SERIES", code: "KOH", name: "King of the Hill",   sortOrder: 7 },
  { categoryCode: "ANIMATED-SERIES", code: "REG", name: "Regular Show",       sortOrder: 8 },
  { categoryCode: "ANIMATED-SERIES", code: "RAM", name: "Rick & Morty",       sortOrder: 9 },
  { categoryCode: "ANIMATED-SERIES", code: "SIM", name: "The Simpsons",       sortOrder: 10 },
  { categoryCode: "ANIMATED-SERIES", code: "SPA", name: "South Park",         sortOrder: 11 },
  { categoryCode: "ANIMATED-SERIES", code: "STU", name: "Steven Universe",    sortOrder: 12 },

  // CARS
  { categoryCode: "CARS", code: "CLASSIC",     name: "Classic Cars",   sortOrder: 1 },
  { categoryCode: "CARS", code: "DIESEL",      name: "Diesel Trucks",  sortOrder: 2 },
  { categoryCode: "CARS", code: "DIRT-TRACK",  name: "Dirt Track",     sortOrder: 3 },
  { categoryCode: "CARS", code: "FANTASY",     name: "Fantasy Cars",   sortOrder: 4 },
  { categoryCode: "CARS", code: "JEEPS",       name: "Jeeps",          sortOrder: 5 },
  { categoryCode: "CARS", code: "LUXURY",      name: "Luxury Cars",    sortOrder: 6 },
  { categoryCode: "CARS", code: "MUSCLE",      name: "Muscle Cars",    sortOrder: 7 },
  { categoryCode: "CARS", code: "PICK-UP",     name: "Pick-Up Trucks", sortOrder: 8 },
  { categoryCode: "CARS", code: "RACE",        name: "Race Cars",      sortOrder: 9 },
  { categoryCode: "CARS", code: "SUVS",        name: "SUVs",           sortOrder: 10 },
  { categoryCode: "CARS", code: "SUPER-SPORTS",name: "Super Sports",   sortOrder: 11 },

  // CHRISTIAN
  { categoryCode: "CHRISTIAN", code: "KJ",  name: "King James",   sortOrder: 1 },
  { categoryCode: "CHRISTIAN", code: "GOD", name: "God",          sortOrder: 2 },
  { categoryCode: "CHRISTIAN", code: "HS",  name: "Holy Spirit",  sortOrder: 3 },
  { categoryCode: "CHRISTIAN", code: "SCR", name: "Scripture",    sortOrder: 4 },
  { categoryCode: "CHRISTIAN", code: "CRS", name: "Cross",        sortOrder: 5 },
  { categoryCode: "CHRISTIAN", code: "HRT", name: "Heart",        sortOrder: 6 },

  // DISNEY
  { categoryCode: "DISNEY", code: "FRZ", name: "Frozen",        sortOrder: 1 },
  { categoryCode: "DISNEY", code: "TLK", name: "Lion King",     sortOrder: 2 },
  { categoryCode: "DISNEY", code: "TOY", name: "Toy Story",     sortOrder: 3 },
  { categoryCode: "DISNEY", code: "MOA", name: "Moana",         sortOrder: 4 },
  { categoryCode: "DISNEY", code: "ENC", name: "Encanto",       sortOrder: 5 },
  { categoryCode: "DISNEY", code: "TNG", name: "Tangled",       sortOrder: 6 },
  { categoryCode: "DISNEY", code: "FNM", name: "Finding Nemo",  sortOrder: 7 },
  { categoryCode: "DISNEY", code: "MON", name: "Monsters Inc",  sortOrder: 8 },
  { categoryCode: "DISNEY", code: "TLM", name: "Little Mermaid",sortOrder: 9 },
  { categoryCode: "DISNEY", code: "MKF", name: "Mickey & Friends",sortOrder: 10 },
  { categoryCode: "DISNEY", code: "WTP", name: "Winnie the Pooh",sortOrder: 11 },
  { categoryCode: "DISNEY", code: "CND", name: "Cinderella",    sortOrder: 12 },
  { categoryCode: "DISNEY", code: "BTB", name: "Beauty & the Beast",sortOrder: 13 },
  { categoryCode: "DISNEY", code: "DS",  name: "Disney Shorts", sortOrder: 14 },

  // DRAGONS
  { categoryCode: "DRAGONS", code: "DRG",     name: "Dragons",        sortOrder: 1 },
  { categoryCode: "DRAGONS", code: "DRG-FIR", name: "Fire Dragons",   sortOrder: 2 },
  { categoryCode: "DRAGONS", code: "DRG-ICE", name: "Ice Dragons",    sortOrder: 3 },
  { categoryCode: "DRAGONS", code: "DRG-FAN", name: "Fantasy Dragons", sortOrder: 4 },

  // FASHION
  { categoryCode: "FASHION", code: "FSH-BAP", name: "Bape",       sortOrder: 1 },
  { categoryCode: "FASHION", code: "FSH-SUP", name: "Supreme",    sortOrder: 2 },
  { categoryCode: "FASHION", code: "FSH-DC",  name: "DC Shoes",   sortOrder: 3 },
  { categoryCode: "FASHION", code: "FSH-SPI", name: "Spiderman",  sortOrder: 4 },
  { categoryCode: "FASHION", code: "FSH-TOY", name: "Toy Machine",sortOrder: 5 },
  { categoryCode: "FASHION", code: "FSH-JOR", name: "Jordan",     sortOrder: 6 },
  { categoryCode: "FASHION", code: "FSH-GUC", name: "Gucci",      sortOrder: 7 },
  { categoryCode: "FASHION", code: "FSH-LV",  name: "Louis Vuitton",sortOrder: 8 },
  { categoryCode: "FASHION", code: "FSH-NIK", name: "Nike",       sortOrder: 9 },
  { categoryCode: "FASHION", code: "FSH-ADI", name: "Adidas",     sortOrder: 10 },
  { categoryCode: "FASHION", code: "FSH-PAL", name: "Palace",     sortOrder: 11 },

  // FLORAL
  { categoryCode: "FLORAL", code: "WORDS-FLOWERS",  name: "Words with Flowers",  sortOrder: 1 },
  { categoryCode: "FLORAL", code: "FLOWERS-WORDS",  name: "Flowers with Words",  sortOrder: 2 },
  { categoryCode: "FLORAL", code: "FLOWERS-AROUND", name: "Flowers Around",      sortOrder: 3 },

  // FLORA-FAUNA
  { categoryCode: "FLORA-FAUNA", code: "FF-ROSES",      name: "Roses",      sortOrder: 1 },
  { categoryCode: "FLORA-FAUNA", code: "FF-ORCHIDS",    name: "Orchids",    sortOrder: 2 },
  { categoryCode: "FLORA-FAUNA", code: "FF-LILIES",     name: "Lilies",     sortOrder: 3 },
  { categoryCode: "FLORA-FAUNA", code: "FF-DAISIES",    name: "Daisies",    sortOrder: 4 },
  { categoryCode: "FLORA-FAUNA", code: "FF-HYDRANGEAS", name: "Hydrangeas", sortOrder: 5 },

  // FLOWERS
  { categoryCode: "FLOWERS", code: "FLO-ROS", name: "Roses",      sortOrder: 1 },
  { categoryCode: "FLOWERS", code: "FLO-CAR", name: "Carnations", sortOrder: 2 },
  { categoryCode: "FLOWERS", code: "FLO-LIL", name: "Lilies",     sortOrder: 3 },
  { categoryCode: "FLOWERS", code: "FLO-ORC", name: "Orchids",    sortOrder: 4 },
  { categoryCode: "FLOWERS", code: "FLO-SUN", name: "Sunflowers", sortOrder: 5 },
  { categoryCode: "FLOWERS", code: "FLO-TUL", name: "Tulips",     sortOrder: 6 },
  { categoryCode: "FLOWERS", code: "FLO-DAI", name: "Daisies",    sortOrder: 7 },
  { categoryCode: "FLOWERS", code: "FLO-LOT", name: "Lotus",      sortOrder: 8 },
  { categoryCode: "FLOWERS", code: "FLO-PEO", name: "Peonies",    sortOrder: 9 },

  // FOOD-DRINK
  { categoryCode: "FOOD-DRINK", code: "SUS", name: "Sushi",      sortOrder: 1 },
  { categoryCode: "FOOD-DRINK", code: "PHO", name: "Pho",        sortOrder: 2 },
  { categoryCode: "FOOD-DRINK", code: "PIZ", name: "Pizza",      sortOrder: 3 },
  { categoryCode: "FOOD-DRINK", code: "BUR", name: "Burgers",    sortOrder: 4 },
  { categoryCode: "FOOD-DRINK", code: "SWE", name: "Sweets",     sortOrder: 5 },
  { categoryCode: "FOOD-DRINK", code: "COF", name: "Coffee",     sortOrder: 6 },
  { categoryCode: "FOOD-DRINK", code: "BOB", name: "Boba",       sortOrder: 7 },

  // GAMING
  { categoryCode: "GAMING", code: "MAR", name: "Mario",       sortOrder: 1 },
  { categoryCode: "GAMING", code: "SON", name: "Sonic",       sortOrder: 2 },
  { categoryCode: "GAMING", code: "DND", name: "D&D",         sortOrder: 3 },
  { categoryCode: "GAMING", code: "ZEL", name: "Zelda",       sortOrder: 4 },
  { categoryCode: "GAMING", code: "MAS", name: "Master Chief",sortOrder: 5 },
  { categoryCode: "GAMING", code: "MCR", name: "Minecraft",   sortOrder: 6 },
  { categoryCode: "GAMING", code: "ROB", name: "Roblox",      sortOrder: 7 },
  { categoryCode: "GAMING", code: "PKM", name: "Pokémon",     sortOrder: 8 },
  { categoryCode: "GAMING", code: "FOR", name: "Fortnite",    sortOrder: 9 },
  { categoryCode: "GAMING", code: "AUS", name: "Among Us",    sortOrder: 10 },
  { categoryCode: "GAMING", code: "FLG", name: "Flags",       sortOrder: 11 },

  // HELLO-KITTY
  { categoryCode: "HELLO-KITTY", code: "HK-MAIN", name: "Hello Kitty Main",   sortOrder: 1 },
  { categoryCode: "HELLO-KITTY", code: "HK-MM",   name: "My Melody",          sortOrder: 2 },
  { categoryCode: "HELLO-KITTY", code: "HK-KU",   name: "Kuromi",             sortOrder: 3 },
  { categoryCode: "HELLO-KITTY", code: "HK-CI",   name: "Cinnamoroll",        sortOrder: 4 },
  { categoryCode: "HELLO-KITTY", code: "HK-PN",   name: "Pompompurin",        sortOrder: 5 },
  { categoryCode: "HELLO-KITTY", code: "HK-KT",   name: "Keroppi",            sortOrder: 6 },

  // HISPANIC
  { categoryCode: "HISPANIC", code: "SAY", name: "Sayings",    sortOrder: 1 },
  { categoryCode: "HISPANIC", code: "ARG", name: "Argentina",  sortOrder: 2 },
  { categoryCode: "HISPANIC", code: "BOL", name: "Bolivia",    sortOrder: 3 },
  { categoryCode: "HISPANIC", code: "BRA", name: "Brazil",     sortOrder: 4 },
  { categoryCode: "HISPANIC", code: "CHL", name: "Chile",      sortOrder: 5 },
  { categoryCode: "HISPANIC", code: "COL", name: "Colombia",   sortOrder: 6 },
  { categoryCode: "HISPANIC", code: "CRC", name: "Costa Rica", sortOrder: 7 },
  { categoryCode: "HISPANIC", code: "CUB", name: "Cuba",       sortOrder: 8 },
  { categoryCode: "HISPANIC", code: "DOM", name: "Dominican Republic", sortOrder: 9 },
  { categoryCode: "HISPANIC", code: "ECU", name: "Ecuador",    sortOrder: 10 },
  { categoryCode: "HISPANIC", code: "SLV", name: "El Salvador",sortOrder: 11 },
  { categoryCode: "HISPANIC", code: "GUA", name: "Guatemala",  sortOrder: 12 },
  { categoryCode: "HISPANIC", code: "HON", name: "Honduras",   sortOrder: 13 },
  { categoryCode: "HISPANIC", code: "MEX", name: "Mexico",     sortOrder: 14 },
  { categoryCode: "HISPANIC", code: "NIC", name: "Nicaragua",  sortOrder: 15 },
  { categoryCode: "HISPANIC", code: "PAN", name: "Panama",     sortOrder: 16 },
  { categoryCode: "HISPANIC", code: "PRY", name: "Paraguay",   sortOrder: 17 },
  { categoryCode: "HISPANIC", code: "PER", name: "Peru",       sortOrder: 18 },
  { categoryCode: "HISPANIC", code: "PRC", name: "Puerto Rico",sortOrder: 19 },
  { categoryCode: "HISPANIC", code: "URY", name: "Uruguay",    sortOrder: 20 },
  { categoryCode: "HISPANIC", code: "VEN", name: "Venezuela",  sortOrder: 21 },

  // MARIO
  { categoryCode: "MARIO", code: "MARIO-CHAR", name: "Mario",      sortOrder: 1 },
  { categoryCode: "MARIO", code: "LUIGI",      name: "Luigi",      sortOrder: 2 },
  { categoryCode: "MARIO", code: "PEACH",      name: "Peach",      sortOrder: 3 },
  { categoryCode: "MARIO", code: "YOSHI",      name: "Yoshi",      sortOrder: 4 },
  { categoryCode: "MARIO", code: "TOADSTOOL",  name: "Toadstool",  sortOrder: 5 },
  { categoryCode: "MARIO", code: "WARIO",      name: "Wario",      sortOrder: 6 },
  { categoryCode: "MARIO", code: "KOOPA",      name: "Koopa",      sortOrder: 7 },

  // MARIJUANA
  { categoryCode: "MARIJUANA", code: "CANNABIS", name: "Cannabis", sortOrder: 1 },

  // MEMES
  { categoryCode: "MEMES", code: "KERMIT",       name: "Kermit",         sortOrder: 1 },
  { categoryCode: "MEMES", code: "MR-BEAN",      name: "Mr. Bean",       sortOrder: 2 },
  { categoryCode: "MEMES", code: "CARTOON-BABY", name: "Cartoon Baby",   sortOrder: 3 },
  { categoryCode: "MEMES", code: "TROLL",        name: "Troll Face",     sortOrder: 4 },
  { categoryCode: "MEMES", code: "GRUMPY-CAT",   name: "Grumpy Cat",     sortOrder: 5 },
  { categoryCode: "MEMES", code: "DRAKE",        name: "Drake",          sortOrder: 6 },
  { categoryCode: "MEMES", code: "SPONGEBOB",    name: "SpongeBob",      sortOrder: 7 },
  { categoryCode: "MEMES", code: "DISTRACTED",   name: "Distracted BF",  sortOrder: 8 },

  // MOVIES
  { categoryCode: "MOVIES", code: "STAR-WARS", name: "Star Wars", sortOrder: 1 },

  // POKEMON
  { categoryCode: "POKEMON", code: "POK-TYP", name: "By Type",       sortOrder: 1 },
  { categoryCode: "POKEMON", code: "POK-GEN", name: "By Generation", sortOrder: 2 },
  { categoryCode: "POKEMON", code: "POK-LGD", name: "Legendary",     sortOrder: 3 },

  // SPORTS
  { categoryCode: "SPORTS", code: "SOC", name: "Soccer",     sortOrder: 1 },
  { categoryCode: "SPORTS", code: "HOC", name: "Hockey",     sortOrder: 2 },
  { categoryCode: "SPORTS", code: "BAS", name: "Basketball", sortOrder: 3 },
  { categoryCode: "SPORTS", code: "FOO", name: "Football",   sortOrder: 4 },
  { categoryCode: "SPORTS", code: "VOL", name: "Volleyball", sortOrder: 5 },
  { categoryCode: "SPORTS", code: "BOX", name: "Boxing",     sortOrder: 6 },
  { categoryCode: "SPORTS", code: "OLY", name: "Olympics",   sortOrder: 7 },

  // TRIP
  { categoryCode: "TRIP", code: "MUSHROOMS",   name: "Mushrooms",    sortOrder: 1 },
  { categoryCode: "TRIP", code: "FROGS",       name: "Frogs",        sortOrder: 2 },
  { categoryCode: "TRIP", code: "TRIP-ANIMALS",name: "Trip Animals", sortOrder: 3 },
  { categoryCode: "TRIP", code: "ALIENS",      name: "Aliens",       sortOrder: 4 },
  { categoryCode: "TRIP", code: "WORDS",       name: "Words",        sortOrder: 5 },
  { categoryCode: "TRIP", code: "CIRCLES",     name: "Circles",      sortOrder: 6 },
  { categoryCode: "TRIP", code: "SQUARES",     name: "Squares",      sortOrder: 7 },

  // TRUMP
  { categoryCode: "TRUMP", code: "MAG", name: "MAGA",       sortOrder: 1 },
  { categoryCode: "TRUMP", code: "TRP", name: "Trump",      sortOrder: 2 },
  { categoryCode: "TRUMP", code: "PAT", name: "Patriot",    sortOrder: 3 },
  { categoryCode: "TRUMP", code: "CON", name: "Conservative",sortOrder: 4 },
  { categoryCode: "TRUMP", code: "AMF", name: "America First",sortOrder: 5 },
  { categoryCode: "TRUMP", code: "REP", name: "Republican", sortOrder: 6 },

  // UNICORNS
  { categoryCode: "UNICORNS", code: "UNI", name: "Unicorns", sortOrder: 1 },
];

export const ensureTaxonomySeeded = mutation({
  handler: async (ctx) => {
    const firstCat = await ctx.db.query("categories").first();
    if (firstCat) {
      return { seeded: false, message: "Already seeded" };
    }

    const now = Date.now();
    let catsAdded = 0;
    let subsAdded = 0;

    for (const cat of CATEGORIES) {
      await ctx.db.insert("categories", {
        code: cat.code,
        name: cat.name,
        icon: cat.icon,
        isActive: true,
        sortOrder: cat.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      catsAdded++;
    }

    for (const sub of SUBCATEGORIES) {
      await ctx.db.insert("subcategories", {
        categoryCode: sub.categoryCode,
        code: sub.code,
        name: sub.name,
        isActive: true,
        sortOrder: sub.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      subsAdded++;
    }

    return {
      seeded: true,
      message: `Initialized ${catsAdded} categories and ${subsAdded} subcategories`,
    };
  },
});

export const getTaxonomyStats = query({
  handler: async (ctx) => {
    const cats = await ctx.db.query("categories").collect();
    const subs = await ctx.db.query("subcategories").collect();
    return { categoryCount: cats.length, subcategoryCount: subs.length };
  },
});
