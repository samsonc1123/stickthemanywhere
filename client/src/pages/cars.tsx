import React from 'react';
import { Link } from 'wouter';
import '../styles/HomePage.css';

const subcategories = [
  { name: 'Classic', color: 'bg-neon-aqua' },
  { name: 'Diesel', color: 'bg-neon-aqua' },
  { name: 'Dirt Track', color: 'bg-neon-aqua' },
  { name: 'Fantasy', color: 'bg-neon-aqua' },
  { name: 'Jeeps', color: 'bg-neon-aqua' },
  { name: 'Luxury', color: 'bg-neon-aqua' },
  { name: 'Muscle', color: 'bg-neon-aqua' },
  { name: 'Pick Up Trucks', color: 'bg-neon-aqua' },
  { name: 'Race', color: 'bg-neon-aqua' },
  { name: 'SUVs', color: 'bg-neon-aqua' },
  { name: 'Super Sports', color: 'bg-neon-aqua' },
];

export default function CarsPage() {
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Scroll handling logic can be added here if needed
  };

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

      {/* Category Title */}
      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="text-yellow-400 text-lg font-bold font-audiowide animate-categoriesFlicker">Cars</h1>
      </div>

      {/* Subcategories */}
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
          {subcategories.map((sub, i) => (
            <button
              key={i}
              className={`inline-block rounded-full ${sub.color} px-4 py-2 mx-1 hover:scale-105 transition-transform font-montserrat`}
              style={{ 
                color: 'black'
              }}
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
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center"
              >
                <span>Car Stickers {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}