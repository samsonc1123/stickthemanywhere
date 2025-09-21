import React from 'react';
import { useLocation, Link } from 'wouter';
import '../styles/HomePage.css';
import peachSticker from '@assets/IMG_2436_1755363915873.png';
import daisySticker from '@assets/IMG_2398_1755361935669.png';

const subcategories = [
  { name: 'Mario', color: 'bg-neon-aqua' },
  { name: 'Luigi', color: 'bg-neon-aqua' },
  { name: 'Princess Peach', color: 'bg-neon-aqua' },
  { name: 'Yoshi', color: 'bg-neon-aqua' },
  { name: 'Toadstool', color: 'bg-neon-aqua' },
  { name: 'Wario', color: 'bg-neon-aqua' },
  { name: 'King Koopa', color: 'bg-neon-aqua' },
];

export default function MarioPage() {
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

      {/* Mario Header */}
      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Mario</h1>
      </div>

      {/* Subcategory Buttons */}
      <div 
        className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'pan-x'
        }}
      >
        {subcategories.map((sub, index) => (
          <button
            key={index}
            className={`inline-block rounded-full ${sub.color} px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform`}
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
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center relative overflow-hidden"
              >
{i === 2 ? (
                  <div 
                    className="flex w-full h-full overflow-x-auto overflow-y-hidden responsive-scroll"
                  >
                    <div className="flex items-center">
                      <div className="w-40 h-40 flex-shrink-0 flex items-center justify-center">
                        <div className="w-32 h-32 flex items-center justify-center">
                          <img 
                            src={daisySticker} 
                            alt="Princess Daisy sticker" 
                            className="max-w-full max-h-full object-contain"
                            style={{
                              backgroundColor: 'transparent',
                              filter: 'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3))'
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-40 h-40 flex-shrink-0 flex items-center justify-center">
                        <div className="w-32 h-32 flex items-center justify-center">
                          <img 
                            src={peachSticker} 
                            alt="Princess Peach sticker" 
                            className="max-w-full max-h-full object-contain"
                            style={{
                              backgroundColor: 'transparent',
                              filter: 'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3))',
                              transform: 'rotate(-90deg)'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span>Sticker {i + 1}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}