import React from 'react';
import { Link } from 'wouter';
import '../styles/HomePage.css';

const subcategories = [
  { name: 'Roses', color: 'bg-neon-aqua' },
  { name: 'Tulips', color: 'bg-neon-aqua' },
  { name: 'Sunflowers', color: 'bg-neon-aqua' },
  { name: 'Lavender', color: 'bg-neon-aqua' },
  { name: 'Cherry Blossoms', color: 'bg-neon-aqua' },
  { name: 'Daisies', color: 'bg-neon-aqua' },
  { name: 'Lilies', color: 'bg-neon-aqua' },
  { name: 'Orchids', color: 'bg-neon-aqua' },
];

export default function FloralCategoryPage() {
  console.log('FloralCategoryPage component loaded!');
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Scroll handling logic can be added here if needed
  };

  return (
    <div className="h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-8 landscape:pt-12 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-3 lg:mb-2">
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

      {/* Floral Header */}
      <div className="text-center mb-3 lg:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Floral</h1>
      </div>

      {/* Subcategories */}
      <div className="flex justify-start mb-3 lg:mb-2 w-full relative">
        <div 
          className="overflow-x-scroll overflow-y-hidden whitespace-nowrap pl-4 pr-4 py-2 w-full auto-hide-scrollbar" 
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth'
          }}
          onScroll={handleScroll}
        >
          {subcategories.map((sub, i) => (
            <button
              key={i}
              className={`inline-block rounded-full ${sub.color} text-black px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      </div>

      {/* Stickers Grid */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-md landscape:max-w-4xl px-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="w-40 h-40 landscape:w-36 landscape:h-36 border-2 border-cyan-400 flex items-center justify-center relative overflow-hidden"
                style={{ 
                  backgroundColor: 'transparent',
                  borderColor: '#00ffff',
                  boxShadow: '0 0 10px #00ffff'
                }}
              >
                <span>Sticker {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}