import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Sticker } from "@shared/schema";

export default function AnimalsPage() {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("birds");

  // Keep loading logic but only fetch when needed
  const { data: subcategoryStickers = [], isLoading: subcategoryLoading } = useQuery<Sticker[]>({
    queryKey: ['/api/stickers/category/animals/subcategory', selectedSubcategory],
    enabled: false, // Only enable when user provides images
  });

  // Sort subcategories alphabetically by first and second letters
  const subcategories = [
    { name: "Axolotls", slug: "axolotls", color: "bg-neon-aqua" },
    { name: "Birds", slug: "birds", color: "bg-neon-aqua" },
    { name: "Butterflys", slug: "butterflys", color: "bg-neon-aqua" },
    { name: "Cats", slug: "cats", color: "bg-neon-aqua" },
    { name: "Dogs", slug: "dogs", color: "bg-neon-aqua" },
    { name: "Elephants", slug: "elephants", color: "bg-neon-aqua" },
    { name: "Lions", slug: "lions", color: "bg-neon-aqua" },
    { name: "Pandas", slug: "pandas", color: "bg-neon-aqua" },
    { name: "Sharks", slug: "sharks", color: "bg-neon-aqua" },
    { name: "Tigers", slug: "tigers", color: "bg-neon-aqua" },
    { name: "Turtles", slug: "turtles", color: "bg-neon-aqua" },
    { name: "Unicorns", slug: "unicorns", color: "bg-neon-aqua" }
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

      {/* Animals Header */}
      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Animals</h1>
      </div>

      {/* Subcategories */}
      <div className="flex justify-start mb-2 landscape:mb-1 w-full">
        <div className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full auto-hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', touchAction: 'pan-x' }}>
          <div className="flex">
            {subcategories.map((subcat) => (
              <button
                key={subcat.name}
                onClick={() => setSelectedSubcategory(subcat.slug)}
                className={`flex-shrink-0 rounded-full ${subcat.color} px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform`}
                style={{
                  color: 'black'
                }}
              >
                {subcat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stickers Vertical Grid with Horizontal Scrolling Inside Each Box */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-md landscape:max-w-4xl px-4">
            {/* First sticker box - empty for user to load stickers */}
            <div
              className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center"
            >
              <div className="flex items-center justify-center w-full h-full">
                <span className="text-cyan-400">{selectedSubcategory}</span>
              </div>
            </div>
            
            {/* Rest of the sticker boxes */}
            {[...Array(9)].map((_, i) => (
              <div
                key={i + 1}
                className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center"
              >
                <span>Sticker {i + 2}</span>
              </div>
            ))}
          </div>
        </div>
      </div>


    </div>
  );
}