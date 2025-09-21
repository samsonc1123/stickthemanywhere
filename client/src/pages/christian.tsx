import React from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import '../styles/HomePage.css';
import trustFlowerSticker from '@assets/IMG_2521_1755367431540.png';
import newCrossSticker from '@assets/IMG_3695_1756251369848.png';
import floralCross from '@assets/IMG_3690_1756254014953.png';
import ornateCross from '@assets/IMG_3693_1756254014953.png';
import colorfulCross from '@assets/IMG_3694_1756254014953.png';
import silhouetteCross from '@assets/IMG_3697_1756254014953.png';
import crucifixCross from '@assets/IMG_3696_1756254014953.png';
import watercolorFloralCross from '@assets/IMG_3699_1756254648400.png';
import godIsGoodCross from '@assets/IMG_3691_1756254648402.png';
import rusticJesusCross from '@assets/IMG_3698_1756254648402.png';
import fruitOfSpiritCross from '@assets/IMG_3692_1756254648402.png';
import youLordCross from '@assets/IMG_3706_1756479356234.png';
import heIsRisenCross from '@assets/IMG_3705_1756479356234.png';
import bibleRainbowCross from '@assets/IMG_3713_1756568226566.png';
import bibleRosaryCross from '@assets/IMG_3714_1756568226569.png';
import doveCross from '@assets/IMG_3715_1756568226569.png';
import communionChalice from '@assets/IMG_3716_1756568226569.png';
import prayingHandsCross from '@assets/IMG_3717_1756568653617.png';
import prayingHandsRosary from '@assets/IMG_3718_1756568653617.png';
import fistRosary from '@assets/IMG_3719_1756568653617.png';
import sunsetCross from '@assets/IMG_3722_1756577997112.png';
import floralGardenCross from '@assets/IMG_3721_1756577997112.png';
import geometricCross from '@assets/IMG_3720_1756577997112.png';
import bibleFloralCross from '@assets/IMG_3724_1756578158779.png';
import dontPanicPrayCross from '@assets/IMG_3725_1756578473550.png';
import ribbonWoodCross from '@assets/IMG_3726_1756579328529.png';
import communionCross from '@assets/IMG_3727_1756579893139.png';
import goodFridayCross from '@assets/IMG_3728_1756579893140.png';
import radiantCross from '@assets/IMG_3729_1756579893140.png';
import sunflowerFaithCross from '@assets/IMG_3731_1756580295360.png';
import heIsRisenFloralCross from '@assets/IMG_3732_1756580295360.png';
import jesusIsAliveCross from '@assets/IMG_4055_1756840462302.png';
import circularSunsetCross from '@assets/IMG_4056_1756841310535.png';
import jesusFishSticker from '@assets/IMG_4148_1757782362364.png';
import jesusScriptSticker from '@assets/IMG_4146_1757783049015.png';
import jesusSavesSticker from '@assets/IMG_4147_1757783049017.png';
import jesusStyleSticker from '@assets/IMG_4149_1757795646665.png';
import lifeSticker from '@assets/IMG_4150_1757798390731.png';
import wildSticker from '@assets/IMG_4151_1757798390732.png';
import jesusBlackFishSticker from '@assets/IMG_4292_1758323486580.png';


const subcategories = [
  { name: 'Crosses', color: 'bg-neon-aqua' },
  { name: 'Christian Floral', color: 'bg-neon-aqua' },
  { name: 'God, the father', color: 'bg-neon-aqua' },
  { name: 'Hearts', color: 'bg-neon-aqua' },
  { name: 'King Jesus', color: 'bg-neon-aqua' },
  { name: 'One Liners', color: 'bg-neon-aqua' },
  { name: 'Pictures w/ Words', color: 'bg-neon-aqua' },
  { name: 'Scripture', color: 'bg-neon-aqua' },
];

export default function ChristianPage() {
  const [, setLocation] = useLocation();
  const [scrollBarPosition, setScrollBarPosition] = React.useState(16);
  const [selectedSubcategory, setSelectedSubcategory] = React.useState<string | null>(null);

  // Fetch cross stickers from database
  const { data: dbCrossStickers = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/stickers/category/Christian/subcategory/Crosses`],
  });
  

  // Love Cross goes first
  const firstCross = [
    {
      id: 'cross-1',
      name: 'Love Cross',
      imageUrl: newCrossSticker
    }
  ];

  // The new crosses go at the very end
  const newCrosses = [
    {
      id: 'cross-2', 
      name: 'Floral Cross',
      imageUrl: floralCross
    },
    {
      id: 'cross-3',
      name: 'Ornate Cross', 
      imageUrl: ornateCross
    },
    {
      id: 'cross-4',
      name: 'Colorful Cross',
      imageUrl: colorfulCross
    },
    {
      id: 'cross-5',
      name: 'Silhouette Cross',
      imageUrl: silhouetteCross
    },
    {
      id: 'cross-6',
      name: 'Crucifix Cross',
      imageUrl: crucifixCross
    },
    {
      id: 'cross-7',
      name: 'Watercolor Floral Cross',
      imageUrl: watercolorFloralCross
    },
    {
      id: 'cross-8',
      name: 'God Is Good Cross',
      imageUrl: godIsGoodCross
    },
    {
      id: 'cross-8a',
      name: 'Sunflower Faith Cross',
      imageUrl: sunflowerFaithCross
    },
    {
      id: 'cross-9',
      name: 'Rustic Jesus Cross',
      imageUrl: rusticJesusCross
    },
    {
      id: 'cross-10',
      name: 'Fruit of Spirit Cross',
      imageUrl: fruitOfSpiritCross
    },
    {
      id: 'cross-11',
      name: 'You Lord Cross',
      imageUrl: youLordCross
    },
    {
      id: 'cross-12',
      name: 'He Is Risen Cross',
      imageUrl: heIsRisenCross
    },
    {
      id: 'cross-12a',
      name: 'He is Risen Floral Cross',
      imageUrl: heIsRisenFloralCross
    },
    {
      id: 'cross-13',
      name: 'Bible Rainbow Cross',
      imageUrl: bibleRainbowCross
    },
    {
      id: 'cross-14',
      name: 'Bible Rosary Cross',
      imageUrl: bibleRosaryCross
    },
    {
      id: 'cross-15',
      name: 'Bible Floral Cross',
      imageUrl: bibleFloralCross
    },
    {
      id: 'cross-16',
      name: 'Dove Cross',
      imageUrl: doveCross
    },
    {
      id: 'cross-18',
      name: 'Communion Chalice',
      imageUrl: communionChalice
    },
    {
      id: 'cross-19',
      name: 'Praying Hands Cross',
      imageUrl: prayingHandsCross
    },
    {
      id: 'cross-20',
      name: 'Praying Hands Rosary',
      imageUrl: prayingHandsRosary
    },
    {
      id: 'cross-21',
      name: 'Fist Rosary',
      imageUrl: fistRosary
    },
    {
      id: 'cross-21a',
      name: 'Circular Sunset Cross',
      imageUrl: circularSunsetCross
    },
    {
      id: 'cross-22',
      name: 'Sunset Cross',
      imageUrl: sunsetCross
    },
    {
      id: 'cross-23',
      name: 'Floral Garden Cross',
      imageUrl: floralGardenCross
    },
    {
      id: 'cross-24',
      name: 'Geometric Cross',
      imageUrl: geometricCross
    },
    {
      id: 'cross-25',
      name: 'Ribbon Wood Cross',
      imageUrl: ribbonWoodCross
    },
    {
      id: 'cross-26',
      name: 'Communion Cross',
      imageUrl: communionCross
    },
    {
      id: 'cross-27',
      name: 'Good Friday Cross',
      imageUrl: goodFridayCross
    },
    {
      id: 'cross-28',
      name: 'Radiant Cross',
      imageUrl: radiantCross
    },
    {
      id: 'cross-31',
      name: 'Jesus is Alive Cross',
      imageUrl: jesusIsAliveCross
    }
  ];

  // Create the combined array first
  const combinedCrosses = [...firstCross, ...dbCrossStickers, ...newCrosses];
  
  // Insert "Don't Panic Pray Cross" at position 17 (index 16)
  const dontPanicCross = {
    id: 'cross-dont-panic',
    name: 'Don\'t Panic Pray Cross',
    imageUrl: dontPanicPrayCross
  };
  
  // Order: Insert Don't Panic Pray Cross at position 17, slide others back
  const crossStickers = [
    ...combinedCrosses.slice(0, 16), // First 16 crosses (positions 1-16)
    dontPanicCross, // Position 17
    ...combinedCrosses.slice(16) // Remaining crosses (positions 18+)
  ];

  // Pictures w/ Words stickers (empty for now)
  const picturesWithWordsStickers: any[] = [];

  // King Jesus stickers
  const kingJesusStickers = [
    {
      id: 'king-jesus-1',
      name: 'Jesus Fish Symbol',
      imageUrl: jesusFishSticker
    },
    {
      id: 'king-jesus-1b',
      name: 'Jesus Black Fish',
      imageUrl: jesusBlackFishSticker
    },
    {
      id: 'king-jesus-2', 
      name: 'Jesus Script',
      imageUrl: jesusScriptSticker
    },
    {
      id: 'king-jesus-3',
      name: 'Jesus Saves',
      imageUrl: jesusSavesSticker
    },
    {
      id: 'king-jesus-4',
      name: 'Jesus Style',
      imageUrl: jesusStyleSticker
    },
    {
      id: 'king-jesus-5',
      name: 'Life',
      imageUrl: lifeSticker
    },
    {
      id: 'king-jesus-6',
      name: 'Wild',
      imageUrl: wildSticker
    }
  ];

  const handleCategoryClick = (categoryName: string) => {
    if (categoryName === 'Christian Floral') {
      setLocation('/floral');
    } else if (categoryName === 'Crosses') {
      // Toggle: if already showing crosses, go back to browse-all mode
      setSelectedSubcategory(selectedSubcategory === 'Crosses' ? null : 'Crosses');
    } else if (categoryName === 'King Jesus') {
      setSelectedSubcategory(selectedSubcategory === 'King Jesus' ? null : 'King Jesus');
    } else {
      // For other subcategories, you can add logic here
      setSelectedSubcategory(null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollLeft = element.scrollLeft;
    const maxScroll = element.scrollWidth - element.clientWidth;
    
    if (maxScroll > 0) {
      const scrollPercentage = scrollLeft / maxScroll;
      // Move bar in opposite direction: when scrolling left (increasing scrollLeft), bar moves right
      // Available space for bar movement: screen width minus padding and bar width
      const availableSpace = window.innerWidth - 32 - 72; // 32px total padding, 72px bar width
      const newPosition = 16 + (scrollPercentage * availableSpace);
      setScrollBarPosition(Math.min(newPosition, window.innerWidth - 72 - 16));
    }
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

      {/* Christian Header */}
      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Christian</h1>
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
              className={`inline-block rounded-full ${sub.color} text-black px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform`}
              onClick={() => handleCategoryClick(sub.name)}
            >
              {sub.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sticker Boxes */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-12 landscape:gap-12 max-w-lg landscape:max-w-4xl px-4">
          {selectedSubcategory ? (
            // Focused mode - show only the specific subcategory box
            (() => {
              // Find the subcategory index to determine the box position
              const subcategoryIndex = subcategories.findIndex(sub => sub.name === selectedSubcategory);
              if (subcategoryIndex === -1) return null;
              
              let stickersToShow = [];
              if (selectedSubcategory === 'Crosses') stickersToShow = crossStickers;
              else if (selectedSubcategory === 'King Jesus') stickersToShow = kingJesusStickers;
              
              return (
                <div
                  className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 flex items-center justify-center"
                  style={{
                    borderColor: '#00ffff',
                    boxShadow: '0 0 8px #00ffff'
                  }}
                >
                  <div
                    className="w-full h-full overflow-x-auto overflow-y-hidden rounded-sm"
                    style={{
                      WebkitOverflowScrolling: 'touch',
                      scrollBehavior: 'smooth',
                      overflowX: 'auto'
                    }}
                  >
                    <div className="flex h-full gap-8">
                      {stickersToShow.map((sticker: any, stickerIndex: number) => (
                        <div
                          key={sticker.id}
                          className="flex-shrink-0 w-full h-full flex items-center justify-center"
                        >
                          <img
                            src={sticker.imageUrl}
                            alt={sticker.name}
                            className="max-w-full max-h-full object-contain"
                            loading="lazy"
                            decoding="async"
                            width="144"
                            height="144"
                            style={{
                              backgroundColor: 'transparent',
                              filter: sticker.name === 'Floral Cross' ? 
                                'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3)) brightness(1.4)' :
                                sticker.name === 'Ornate Cross' ?
                                'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3)) brightness(1.4) hue-rotate(280deg)' :
                                'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3))',
                              transform: sticker.name === 'Ribbon Wood Cross' ? 'rotate(-90deg)' : 
                                        sticker.name === 'Jesus Style' ? 'rotate(-60deg)' : 
                                        sticker.name === 'Life' ? 'rotate(-90deg)' : 
                                        sticker.name === 'Wild' ? 'rotate(-25deg)' : 'none',
                              contentVisibility: 'auto',
                              containIntrinsicSize: '144px 144px'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            // Browse-all mode - show all subcategory boxes
            Array.from({ length: 15 }, (_, i) => {
              // Box position correlates with subcategory button position
              let boxContent = null;
              
              if (i === 0) {
                // Box 1: Crosses (1st subcategory button)
                boxContent = crossStickers.map((sticker: any, stickerIndex: number) => (
                  <div key={sticker.id} className="flex-shrink-0 w-full h-full flex items-center justify-center">
                    <img 
                      src={sticker.imageUrl} 
                      alt={sticker.name} 
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      width="144"
                      height="144"
                      style={{ 
                        backgroundColor: 'transparent', 
                        filter: sticker.name === 'Floral Cross' ? 
                          'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3)) brightness(1.4)' :
                          sticker.name === 'Ornate Cross' ?
                          'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3)) brightness(1.4) hue-rotate(280deg)' :
                          'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3))',
                        transform: sticker.name === 'Ribbon Wood Cross' ? 'rotate(-90deg)' : 'none',
                        contentVisibility: 'auto',
                        containIntrinsicSize: '144px 144px'
                      }} 
                    />
                  </div>
                ));
              } else if (i === 1) {
                // Box 2: Christian Floral (2nd subcategory button) - navigates to /floral
                boxContent = (
                  <div className="flex-shrink-0 w-full h-full flex items-center justify-center">
                    <span style={{ color: '#00ffff' }}>Christian Floral</span>
                  </div>
                );
              } else if (i === 4) {
                // Box 5: King Jesus (5th subcategory button)
                boxContent = kingJesusStickers.map((sticker: any) => (
                  <div key={sticker.id} className="flex-shrink-0 w-full h-full flex items-center justify-center">
                    <img 
                      src={sticker.imageUrl} 
                      alt={sticker.name} 
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      width="144"
                      height="144"
                      style={{ 
                        backgroundColor: 'transparent', 
                        filter: 'drop-shadow(0 0 4px rgba(0, 255, 255, 0.3))',
                        transform: sticker.name === 'Jesus Style' ? 'rotate(-60deg)' : 
                                  sticker.name === 'Life' ? 'rotate(-90deg)' : 
                                  sticker.name === 'Wild' ? 'rotate(-25deg)' : 'none',
                        contentVisibility: 'auto',
                        containIntrinsicSize: '144px 144px'
                      }} 
                    />
                  </div>
                ));
              }
              
              if (!boxContent) {
                boxContent = (
                  <div className="flex-shrink-0 w-full h-full flex items-center justify-center">
                    <span style={{ color: '#00ffff' }}>Sticker {i + 1}</span>
                  </div>
                );
              }
              
              return (
                <div key={i} className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 flex items-center justify-center"
                     style={{ borderColor: '#00ffff', boxShadow: '0 0 8px #00ffff' }}>
                  <div className="w-full h-full overflow-x-auto overflow-y-hidden rounded-sm"
                       style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', overflowX: 'auto' }}>
                    <div className="flex h-full gap-8">
                      {boxContent}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>
      </div>
    </div>
  );
}