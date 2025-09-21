import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Sticker } from "@shared/schema";

export default function AnimatedSeriesPage() {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("simpsons");

  // Keep loading logic but only fetch when needed
  const { data: subcategoryStickers = [], isLoading: subcategoryLoading } = useQuery<Sticker[]>({
    queryKey: ['/api/stickers/category/animatedseries/subcategory', selectedSubcategory],
    enabled: false, // Only enable when user provides images
  });

  // Pushing boundaries with popular animated series that make great stickers
  const subcategories = [
    { name: "Adventure Time", slug: "adventuretime", color: "bg-neon-aqua" },
    { name: "Beavis and Butthead", slug: "beavisandbutthead", color: "bg-neon-aqua" },
    { name: "Bob's Burgers", slug: "bobsburgers", color: "bg-neon-aqua" },
    { name: "Boondocks", slug: "boondocks", color: "bg-neon-aqua" },
    { name: "Family Guy", slug: "familyguy", color: "bg-neon-aqua" },
    { name: "Futurama", slug: "futurama", color: "bg-neon-aqua" },
    { name: "King of the Hill", slug: "kingofthehill", color: "bg-neon-aqua" },
    { name: "Regular Show", slug: "regularshow", color: "bg-neon-aqua" },
    { name: "Rick and Morty", slug: "rickandmorty", color: "bg-neon-aqua" },
    { name: "Simpsons", slug: "simpsons", color: "bg-neon-aqua" },
    { name: "South Park", slug: "southpark", color: "bg-neon-aqua" },
    { name: "Steven Universe", slug: "stevenuniverse", color: "bg-neon-aqua" }
  ];

  return (
    <div className="h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-2 landscape:mb-1">
        <Link href="/">
          <div className="text-5xl font-cursive font-bold mb-2 cursor-pointer">
            {/* Vertical Layout (Portrait) */}
            <div className="flex flex-col items-center landscape:hidden">
              <div className="flex items-center">
                <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
                <span className="text-pink-400 text-2xl transform rotate-12 inline-block mx-2" style={{ fontFamily: 'Pacifico, cursive' }}>Them</span>
              </div>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
            
            {/* Horizontal Layout (Landscape) */}
            <div className="hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-2 landscape:text-4xl">
              <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
              <span className="text-pink-400 text-xl transform rotate-12 inline-block" style={{ fontFamily: 'Pacifico, cursive' }}>Them</span>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Animated Series Header - Split animation for two words */}
      <div className="text-center mb-2 landscape:mb-1">
        <div className="flex items-center justify-center space-x-2">
          <div className="text-yellow-400 text-lg font-bold font-audiowide animate-flicker-fast opacity-70">
            Animated
          </div>
          <span className="text-yellow-400 text-lg font-bold font-audiowide animate-flicker-slow">Series</span>
        </div>
      </div>

      {/* Subcategories */}
      <div className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'pan-x'
        }}
      >
        {subcategories.map((subcat) => (
          <button
            key={subcat.name}
            onClick={() => setSelectedSubcategory(subcat.slug)}
            className={`inline-block rounded-full ${subcat.color} px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform`}
            style={{
              color: 'black'
            }}
          >
            {subcat.name}
          </button>
        ))}
      </div>

      {/* Stickers Vertical Grid */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
            {subcategories.map((sub, i) => (
              <div
                key={i}
                className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center relative overflow-hidden"
              >
                <div 
                  className="w-full h-full overflow-x-scroll auto-hide-scrollbar flex items-center" 
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollBehavior: 'smooth'
                  }}
                >
                  <div className="flex gap-2 px-2">
                    <span className="text-cyan-400">
                      Box {i + 1}: {sub.name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}