import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';

const pokemonTypes = [
  { name: 'Bug', color: 'bg-neon-aqua' },
  { name: 'Dark', color: 'bg-neon-aqua' },
  { name: 'Dragon', color: 'bg-neon-aqua' },
  { name: 'Electric', color: 'bg-neon-aqua' },
  { name: 'Fairy', color: 'bg-neon-aqua' },
  { name: 'Fighting', color: 'bg-neon-aqua' },
  { name: 'Fire', color: 'bg-neon-aqua' },
  { name: 'Flying', color: 'bg-neon-aqua' },
  { name: 'Ghost', color: 'bg-neon-aqua' },
  { name: 'Grass', color: 'bg-neon-aqua' },
  { name: 'Ground', color: 'bg-neon-aqua' },
  { name: 'Ice', color: 'bg-neon-aqua' },
  { name: 'Normal', color: 'bg-neon-aqua' },
  { name: 'Poison', color: 'bg-neon-aqua' },
  { name: 'Psychic', color: 'bg-neon-aqua' },
  { name: 'Rock', color: 'bg-neon-aqua' },
  { name: 'Steel', color: 'bg-neon-aqua' },
  { name: 'Water', color: 'bg-neon-aqua' }
];

export default function PokemonPage() {
  const [currentColorIndex, setCurrentColorIndex] = useState(0);

  // Fetch Pokemon stickers
  const { data: pokemonStickers = [], isLoading } = useQuery({
    queryKey: ['/api/stickers/category/Pokemon/subcategory/Types'],
    retry: false,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentColorIndex((prevIndex) => (prevIndex + 1) % pokemonTypes.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Handle scroll events if needed
  };

  const handleTypeClick = (typeName: string) => {
    // Handle type selection if needed
    console.log(`Selected ${typeName} type`);
  };

  return (
    <div className="h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 overflow-hidden">
      {/* Main Title */}
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

      {/* Pokemon Subtitle */}
      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Pokemon</h1>
      </div>

      {/* Pokemon Type Buttons */}
      <div className="flex justify-start mb-2 landscape:mb-1 w-full relative">
        <div 
          className="overflow-x-scroll overflow-y-hidden whitespace-nowrap pl-4 pr-4 py-2 w-full auto-hide-scrollbar" 
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            touchAction: 'pan-x'
          }}
          onScroll={handleScroll}
        >
          {pokemonTypes.map((type, i) => (
            <button
              key={i}
              className={`inline-block rounded-full ${type.color} px-4 py-2 mx-1 hover:scale-105 transition-transform font-montserrat`}
              style={{ 
                color: 'black'
              }}
              onClick={() => handleTypeClick(type.name)}
            >
              {type.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sticker Boxes */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
          {pokemonTypes.map((type, i) => (
            <div
              key={i}
              className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center"
              >
                <div
                  className="w-full h-full overflow-hidden rounded-sm"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    scrollBehavior: 'smooth'
                  }}
                >
                  <div className="flex gap-2 px-2">
                    <span style={{ color: '#00e5ff' }}>
                      {type.name} Type
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