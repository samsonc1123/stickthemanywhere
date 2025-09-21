import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Cross, Heart, Star, Gamepad2, TreePine, Sparkles } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  subcategories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

const getCategoryIcon = (categorySlug: string) => {
  switch (categorySlug) {
    case 'christian':
      return <Cross className="h-6 w-6" />;
    case 'animals':
      return <Heart className="h-6 w-6" />;
    case 'nature':
      return <TreePine className="h-6 w-6" />;
    case 'gaming':
      return <Gamepad2 className="h-6 w-6" />;
    case 'abstract':
      return <Sparkles className="h-6 w-6" />;
    default:
      return <Star className="h-6 w-6" />;
  }
};

export function CategoryButtons() {
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-white">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="mb-12">
      {/* Horizontal scrollable category buttons */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-neon-blue">
        {categories.map((category) => (
          <Link key={category.id} href={`/category/${category.slug}`}>
            <div className={`
              flex-shrink-0 flex items-center gap-3 px-6 py-3 rounded-full
              border-2 border-${category.color} text-${category.color}
              hover:bg-${category.color} hover:text-black
              transition-all duration-300 cursor-pointer
              hover:shadow-lg hover:shadow-${category.color}/50
              min-w-fit bg-transparent
            `}>
              {getCategoryIcon(category.slug)}
              <span className="font-semibold">{category.name}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Browse Categories heading with glitch effect */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-neon-yellow glitch-text" data-text="Browse Categories">
          Browse Categories
        </h2>
      </div>

      {/* Horizontal row of square sticker preview boxes */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-neon-blue">
        {[...Array(8)].map((_, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-[200px] h-[200px] border-2 border-neon-blue rounded-lg bg-light-gray/20 flex items-center justify-center"
          >
            <div className="text-gray-400 text-center">
              <div className="text-4xl mb-2">🔷</div>
              <p className="text-sm">Sticker {index + 1}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}