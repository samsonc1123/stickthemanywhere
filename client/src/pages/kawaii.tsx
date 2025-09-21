import React from 'react';
import { useLocation, Link } from 'wouter';
import '../styles/HomePage.css';
import helloKittySticker from '@assets/IMG_2799_1755473666618.png';
import helloKittyChef from '@assets/IMG_2801_1755473762231.png';
import helloKittyWinter from '@assets/IMG_2802_1755473762232.png';
import helloKittyCamera from '@assets/IMG_2800_1755473762232.png';
import helloKittyFlower from '@assets/IMG_2803_1755473762232.png';
import helloKittyBaking from '@assets/IMG_2804_1755473762232.png';
import helloKittyPrincess from '@assets/IMG_2805_1755473762232.png';
import helloKittyScarf from '@assets/IMG_2806_1755473762232.png';

const subcategories = [
  { name: 'Hello Kitty', color: 'bg-neon-pink' },
  { name: 'My Melody', color: 'bg-neon-pink' },
  { name: 'Pochacco', color: 'bg-neon-pink' },
  { name: 'Cinnamoroll', color: 'bg-neon-pink' },
  { name: 'Kuromi', color: 'bg-neon-pink' },
  { name: 'Tuxedosam', color: 'bg-neon-pink' },
  { name: 'Gudetama', color: 'bg-neon-pink' },
  { name: 'Little Twin Stars', color: 'bg-neon-pink' },
  { name: 'Keroppi', color: 'bg-neon-pink' },
  { name: 'Badtz-Maru', color: 'bg-neon-pink' },
  { name: 'Rururugakuen', color: 'bg-neon-pink' },
  { name: 'Chococat', color: 'bg-neon-pink' },
];

export default function KawaiiPage() {
  // Define stickers for each character box
  const characterStickers: Record<string, string[]> = {
    'Hello Kitty': [
      helloKittySticker, helloKittyChef, helloKittyWinter, helloKittyCamera, 
      helloKittyFlower, helloKittyBaking, helloKittyPrincess, helloKittyScarf
    ],
    'My Melody': [],
    'Pochacco': [],
    'Cinnamoroll': [],
    'Kuromi': [],
    'Tuxedosam': [],
    'Gudetama': [],
    'Little Twin Stars': [],
    'Keroppi': [],
    'Badtz-Maru': [],
    'Rururugakuen': [],
    'Chococat': []
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

      {/* Hello Kitty Header */}
      <div className="text-center mb-2 landscape:mb-1">
        <div className="flex items-center justify-center space-x-2">
          <div className="text-yellow-400 text-lg font-bold font-audiowide animate-flicker-fast opacity-70">
            Hello
          </div>
          <span className="text-yellow-400 text-lg font-bold font-audiowide animate-flicker-slow">Kitty</span>
        </div>
      </div>

      {/* Subcategory Buttons */}
      <div className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar" 
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
            {subcategories.map((sub, i) => (
              <div
                key={i}
                className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 flex items-center justify-center relative overflow-hidden"
                style={{ 
                  backgroundColor: 'transparent',
                  borderColor: '#ff69b4',
                  boxShadow: '0 0 10px #ff69b4'
                }}
              >
                <div 
                  className="w-full h-full overflow-x-scroll auto-hide-scrollbar flex items-center" 
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollBehavior: 'smooth'
                  }}
                >
                  <div className="flex gap-2 px-2">
                    {(() => {
                      const characterName = subcategories[i]?.name;
                      const stickers = characterStickers[characterName] || [];
                      
                      if (stickers.length > 0) {
                        return stickers.map((sticker, stickerIndex) => (
                          <img 
                            key={stickerIndex}
                            src={sticker} 
                            alt={`${characterName} Sticker ${stickerIndex + 1}`} 
                            className="w-32 h-32 object-contain flex-shrink-0"
                            style={{
                              backgroundColor: 'transparent',
                              filter: 'drop-shadow(0 0 4px rgba(255, 105, 180, 0.3))'
                            }}
                          />
                        ));
                      } else {
                        return <span className="text-center w-full">{characterName || `Sticker ${i + 1}`}</span>;
                      }
                    })()}
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