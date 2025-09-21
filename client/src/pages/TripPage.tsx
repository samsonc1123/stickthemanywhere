import React from 'react';
import { Link } from 'wouter';
import '../styles/HomePage.css';

const subcategories = [
  { name: 'Mushrooms', color: 'bg-trip-morphing' },
  { name: 'Frogs', color: 'bg-trip-morphing' },
  { name: 'Animals', color: 'bg-trip-morphing' },
  { name: 'Aliens', color: 'bg-trip-morphing' },
  { name: 'Words', color: 'bg-trip-morphing' },
  { name: 'Circles', color: 'bg-trip-morphing' },
  { name: 'Squares', color: 'bg-trip-morphing' },
];

export default function TripPage() {
  return (
    <div className="h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 overflow-hidden">
      
      {/* Header */}
      <div className="text-center mb-2 landscape:mb-1 relative z-10">
        <Link href="/">
          <div className="text-5xl font-cursive font-bold mb-2 cursor-pointer">
            {/* Vertical Layout (Portrait) */}
            <div className="flex flex-col items-center landscape:hidden">
              <div className="flex items-center">
                <span className="glow-psychedelic animate-reality-shift">Stick</span>
                <span className="text-trip-morph text-2xl animate-slow-spin inline-block mx-2" style={{ fontFamily: 'Pacifico, cursive' }}>Them</span>
              </div>
              <span className="glow-psychedelic animate-reality-shift">Anywhere</span>
            </div>
            
            {/* Horizontal Layout (Landscape) */}
            <div className="hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-2 landscape:text-4xl">
              <span className="glow-psychedelic animate-reality-shift">Stick</span>
              <span className="text-trip-morph text-xl animate-slow-spin inline-block" style={{ fontFamily: 'Pacifico, cursive' }}>Them</span>
              <span className="glow-psychedelic animate-reality-shift">Anywhere</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Psychedelic Title */}
      <div className="text-center mb-2 landscape:mb-1 relative z-10">
        <h1 className="font-bold text-trip-rainbow animate-impossible-colors font-audiowide text-lg">
          Psychedelic
        </h1>
      </div>

      {/* Subcategories */}
      <div className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar relative z-10" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'pan-x'
        }}
      >
        {subcategories.map((sub, i) => (
          <button
            key={i}
            className={`inline-block rounded-full trip-button px-4 py-2 mx-1 font-montserrat animate-color-morph relative overflow-hidden`}
            style={{ 
              color: 'black',
              background: 'linear-gradient(45deg, #ff0080, #00ff80, #8000ff, #ff8000, #0080ff)',
              backgroundSize: '400% 400%',
              animation: 'trip-gradient 3s ease infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          >
            <span className="relative z-10 font-bold text-shadow">
              {sub.name}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer"></div>
          </button>
        ))}
      </div>

      {/* Stickers Grid */}
      <div className="flex-1 overflow-y-auto w-full relative z-10">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
            {subcategories.map((sub, i) => (
              <div
                key={i}
                className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center"
                style={{
                  boxShadow: '0 0 0 1px #ff0080',
                  animation: 'psychedelic-border 4s linear infinite'
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