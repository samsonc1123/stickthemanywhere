import { useQuery } from "@tanstack/react-query";

export function useCategories() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['/api/categories'],
    initialData: [
      {
        id: 1,
        name: "Animals",
        slug: "animals",
        color: "neon-pink",
        subcategories: [
          { id: 1, name: "Cats", slug: "cats" },
          { id: 2, name: "Dogs", slug: "dogs" },
          { id: 16, name: "Birds", slug: "birds" },
          { id: 24, name: "Fish", slug: "fish" },
          { id: 25, name: "Serpent", slug: "serpent" },
          { id: 26, name: "Unicorns", slug: "unicorns" },
          { id: 27, name: "Beast", slug: "beast" },
          { id: 28, name: "Sub", slug: "sub" },
          { id: 29, name: "Burden", slug: "burden" }
        ]
      },
      {
        id: 7,
        name: "Cars",
        slug: "cars",
        color: "neon-blue",
        subcategories: [
          { id: 30, name: "Sports Cars", slug: "sports-cars" },
          { id: 31, name: "Vintage", slug: "vintage" },
          { id: 32, name: "Electric", slug: "electric" },
          { id: 33, name: "Luxury", slug: "luxury" }
        ]
      },
      {
        id: 8,
        name: "Fashion",
        slug: "fashion",
        color: "neon-pink",
        subcategories: [
          { id: 34, name: "Streetwear", slug: "streetwear" },
          { id: 35, name: "Vintage", slug: "vintage" },
          { id: 36, name: "Haute Couture", slug: "haute-couture" },
          { id: 37, name: "Accessories", slug: "accessories" }
        ]
      },
      {
        id: 2,
        name: "Nature",
        slug: "nature",
        color: "neon-blue",
        subcategories: [
          { id: 4, name: "Plants", slug: "plants" },
          { id: 5, name: "Trees", slug: "trees" },
          { id: 6, name: "Flowers", slug: "flowers" }
        ]
      },
      {
        id: 3,
        name: "Gaming",
        slug: "gaming",
        color: "neon-purple",
        subcategories: [
          { id: 7, name: "Retro", slug: "retro" },
          { id: 8, name: "Characters", slug: "characters" },
          { id: 9, name: "Logos", slug: "logos" }
        ]
      },
      {
        id: 4,
        name: "Abstract",
        slug: "abstract",
        color: "neon-pink",
        subcategories: [
          { id: 10, name: "Shapes", slug: "shapes" },
          { id: 11, name: "Patterns", slug: "patterns" }
        ]
      },
      {
        id: 5,
        name: "Emoji",
        slug: "emoji",
        color: "neon-yellow",
        subcategories: [
          { id: 12, name: "Faces", slug: "faces" },
          { id: 13, name: "Symbols", slug: "symbols" }
        ]
      },
      {
        id: 6,
        name: "Fantasy",
        slug: "fantasy",
        color: "neon-purple",
        subcategories: [
          { id: 14, name: "Creatures", slug: "creatures" },
          { id: 15, name: "Magical", slug: "magical" }
        ]
      },
      {
        id: 9,
        name: "Christian",
        slug: "christian",
        color: "neon-yellow",
        subcategories: [
          { id: 38, name: "Hearts", slug: "hearts" },
          { id: 39, name: "Crosses", slug: "crosses" },
          { id: 40, name: "Jesus Name", slug: "jesus-name" },
          { id: 41, name: "Pictures", slug: "pictures" },
          { id: 42, name: "Pictures with Words", slug: "pictures-with-words" }
        ]
      }
    ]
  });

  return {
    categories: data,
    isLoading
  };
}
