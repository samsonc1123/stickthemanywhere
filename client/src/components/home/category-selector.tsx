import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { 
  AppWindow, 
  Cat, 
  Leaf, 
  Gamepad2, 
  CircleOff, 
  Smile, 
  BugOff,
  Cross,
  Car,
  Shirt
} from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { Button } from "@/components/ui/button";

export function CategorySelector() {
  const { categories, isLoading } = useCategories();
  const scrollRef = useRef<HTMLDivElement>(null);

  const categoryIcons = {
    "All": <AppWindow className="h-4 w-4" />,
    "Animals": <Cat className="h-4 w-4" />,
    "Flora & Fauna": <Leaf className="h-4 w-4" />,
    "Gaming": <Gamepad2 className="h-4 w-4" />,
    "Abstract": <CircleOff className="h-4 w-4" />,
    "Emoji": <Smile className="h-4 w-4" />,
    "Fantasy": <BugOff className="h-4 w-4" />,
    "Cars": <Car className="h-4 w-4" />,
    "Fashion": <Shirt className="h-4 w-4" />,
    "Christian": <Cross className="h-4 w-4" />,
    "Christian Faith": <Cross className="h-4 w-4" />
  };

  // Function to scroll the category selector horizontally
  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-poppins font-bold mb-6 text-white">
        <span className="text-glow-yellow">Browse</span> Categories
      </h2>
      
      <div className="relative">
        <div 
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
        >
          <Button
            className="category-pill whitespace-nowrap px-6 py-3 bg-neon-blue bg-opacity-20 text-black rounded-full flex items-center gap-2 neon-border-blue"
            asChild
          >
            <Link href="/products">
              <div className="flex items-center gap-2">
                <AppWindow className="h-4 w-4" />
                <span>All Categories</span>
              </div>
            </Link>
          </Button>
          
          {categories.map((category, index) => {
            // Alternate colors: pink, blue, yellow, purple, repeat
            const colors = ["neon-pink", "neon-blue", "neon-yellow", "neon-purple"];
            const colorClass = colors[index % 4];
            // Text color depends on the button color
            const textColorClass = colorClass === "neon-pink" ? "text-white" : 
                                   colorClass === "neon-yellow" ? "text-black" : "text-black";
            
            // Custom navigation for specific categories
            const getHref = () => {
              console.log('Category clicked:', category.name); // Debug log
              if (category.name === 'Flora & Fauna') {
                console.log('Navigating to flora-fauna page');
                return '/flora-fauna';
              }
              if (category.name === 'Christian' || category.name === 'Christian Faith') {
                return '/christian';
              }
              if (category.name === 'Gaming') {
                return '/gaming';
              }
              return `/products/${category.slug}`;
            };

            return (
              <Button
                key={category.id}
                className={`category-pill whitespace-nowrap px-6 py-3 bg-${colorClass} bg-opacity-20 ${textColorClass} rounded-full flex items-center gap-2 neon-border-${colorClass}`}
                asChild
              >
                <Link href={getHref()}>
                  <div className="flex items-center gap-2">
                    {categoryIcons[category.name as keyof typeof categoryIcons] || <AppWindow className="h-4 w-4" />}
                    <span>{category.name}</span>
                  </div>
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
