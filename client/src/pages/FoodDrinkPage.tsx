import React from 'react';
import { Link } from 'wouter';
import '../styles/HomePage.css';

const subcategories = [
  { name: 'Sushi', color: 'bg-neon-aqua' },
  { name: 'Pho', color: 'bg-neon-aqua' },
  { name: 'Pizza', color: 'bg-neon-aqua' },
  { name: 'Burgers', color: 'bg-neon-aqua' },
  { name: 'Sweets', color: 'bg-neon-aqua' },
  { name: 'Coffee', color: 'bg-neon-aqua' },
  { name: 'Boba', color: 'bg-neon-aqua' },
];

export default function FoodDrinkPage() {
  return (
    <div className="h-screen bg-perforated text-white flex flex-col items-center p-4 pt-4 landscape:pt-2 overflow-hidden">
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

      {/* Food & Drink Title */}
      <div className="text-center mb-4 lg:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Food & Drink</h1>
      </div>

      {/* Subcategories */}
      <div className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-3 lg:mb-2 auto-hide-scrollbar" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'pan-x'
        }}
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

      {/* Stickers Grid */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-12 max-w-lg landscape:max-w-4xl px-4">
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
                  <div className="flex gap-8 px-2">
                    <span style={{ color: '#06b6d4' }}>
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