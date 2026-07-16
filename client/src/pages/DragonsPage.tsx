import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { loadStickers } from "@/lib/loadStickers";

export default function DragonsPage() {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");

  const subcategories = [
    { name: "All", slug: "all", color: "bg-red-600", prefix: "DRG" },
    { name: "Fire", slug: "fire", color: "bg-red-600", prefix: "DRG-FIR" },
    { name: "Ice", slug: "ice", color: "bg-red-600", prefix: "DRG-ICE" },
    { name: "Fantasy", slug: "fantasy", color: "bg-red-600", prefix: "DRG-FAN" }
  ];

  const { data: stickers = [], isLoading } = useQuery({
    queryKey: ['stickers', 'dragons', 'DRG'],
    queryFn: () => loadStickers(['DRG']),
  });

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 pb-16">
      <div className="text-center mb-2 landscape:mb-1">
        <Link href="/">
          <div className="text-5xl font-cursive font-bold mb-2 cursor-pointer">
            <div className="flex flex-col items-center landscape:hidden">
              <div className="flex items-center">
                <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
                <span className="text-pink-400 text-2xl transform rotate-12 inline-block mx-2" style={{ fontFamily: 'Pacifico, cursive' }}>Them</span>
              </div>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
            
            <div className="hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-2 landscape:text-4xl">
              <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
              <span className="text-pink-400 text-xl transform rotate-12 inline-block" style={{ fontFamily: 'Pacifico, cursive' }}>Them</span>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Dragons</h1>
      </div>

      <div className="flex justify-start mb-2 landscape:mb-1 w-full">
        <div className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full auto-hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', touchAction: 'pan-x' }}>
          <div className="flex">
            <Link href="/">
              <button
                className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 mx-1 hover:scale-105 transition-transform"
                style={{ color: 'white' }}
                data-testid="button-back"
              >
                ←
              </button>
            </Link>
            {subcategories.map((subcat) => (
              <button
                key={subcat.name}
                onClick={() => setSelectedSubcategory(subcat.slug)}
                className={`flex-shrink-0 rounded-full ${subcat.color} px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform`}
                style={{ color: 'white' }}
              >
                {subcat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
            {isLoading ? (
              <div className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 border-red-600 flex items-center justify-center">
                <span className="text-red-400 animate-pulse">Loading...</span>
              </div>
            ) : stickers.length > 0 ? (
              stickers.map((sticker, i) => (
                <div key={i} className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 border-red-600 flex items-center justify-center overflow-hidden">
                  <img 
                    src={sticker.url} 
                    alt={sticker.name || sticker.asset_code}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ))
            ) : (
              <div className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 border-red-600 flex items-center justify-center">
                <span className="text-gray-500">No stickers yet</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
