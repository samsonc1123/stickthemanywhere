import { Link, useLocation } from 'wouter';
import { useRef, useCallback } from 'react';
import { FloatingThem } from '../components/FloatingThem';


export default function HomePage() {
  const [, setLocation] = useLocation();
  
  // Ref for FloatingThem to measure the title "Them" position
  const themTitleRef = useRef<HTMLSpanElement>(null);

  // Track which words are currently pressed
  const stickPressed = useRef(false);
  const themPressed = useRef(false);
  const anywherePressed = useRef(false);
  const adminTimer = useRef<number | null>(null);

  const checkAllPressed = useCallback(() => {
    if (stickPressed.current && themPressed.current && anywherePressed.current) {
      if (!adminTimer.current) {
        adminTimer.current = window.setTimeout(() => {
          setLocation('/admin');
          adminTimer.current = null;
        }, 1000);
      }
    } else {
      if (adminTimer.current) {
        clearTimeout(adminTimer.current);
        adminTimer.current = null;
      }
    }
  }, [setLocation]);

  const handleStickStart = () => {
    stickPressed.current = true;
    checkAllPressed();
  };

  const handleStickEnd = () => {
    stickPressed.current = false;
    checkAllPressed();
  };

  const handleThemStart = () => {
    themPressed.current = true;
    checkAllPressed();
  };

  const handleThemEnd = () => {
    themPressed.current = false;
    checkAllPressed();
  };

  const handleAnywhereStart = () => {
    anywherePressed.current = true;
    checkAllPressed();
  };

  const handleAnywhereEnd = () => {
    anywherePressed.current = false;
    checkAllPressed();
  };

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2">
      <FloatingThem titleRef={themTitleRef} />
      {/* Title */}
      <div className="text-center mb-2 landscape:mb-1">
        <div className="text-5xl font-cursive font-bold mb-2 cursor-pointer">
          {/* Vertical Layout (Portrait) */}
          <div className="flex flex-col items-center landscape:hidden">
            <div className="flex items-center">
              <span 
                className="glow-yellow animate-flicker-extremely-slow-single select-none"
                onMouseDown={handleStickStart}
                onMouseUp={handleStickEnd}
                onMouseLeave={handleStickEnd}
                onTouchStart={handleStickStart}
                onTouchEnd={handleStickEnd}
                onTouchCancel={handleStickEnd}
              >
                Stick
              </span>
              <span 
                ref={themTitleRef}
                className="text-pink-400 text-2xl transform rotate-12 inline-block mx-2 select-none" 
                style={{ fontFamily: 'Pacifico, cursive', visibility: 'hidden' }}
                onMouseDown={handleThemStart}
                onMouseUp={handleThemEnd}
                onMouseLeave={handleThemEnd}
                onTouchStart={handleThemStart}
                onTouchEnd={handleThemEnd}
                onTouchCancel={handleThemEnd}
              >
                Them
              </span>
            </div>
            <span 
              className="glow-yellow animate-flicker-extremely-slow-single select-none"
              onMouseDown={handleAnywhereStart}
              onMouseUp={handleAnywhereEnd}
              onMouseLeave={handleAnywhereEnd}
              onTouchStart={handleAnywhereStart}
              onTouchEnd={handleAnywhereEnd}
              onTouchCancel={handleAnywhereEnd}
            >
              Anywhere
            </span>
          </div>
          
          {/* Horizontal Layout (Landscape) */}
          <div className="hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-2 landscape:text-4xl">
            <span 
              className="glow-yellow animate-flicker-extremely-slow-single select-none"
              onMouseDown={handleStickStart}
              onMouseUp={handleStickEnd}
              onMouseLeave={handleStickEnd}
              onTouchStart={handleStickStart}
              onTouchEnd={handleStickEnd}
              onTouchCancel={handleStickEnd}
            >
              Stick
            </span>
            <span 
              className="text-pink-400 text-xl transform rotate-12 inline-block select-none" 
              style={{ fontFamily: 'Pacifico, cursive', visibility: 'hidden' }}
              onMouseDown={handleThemStart}
              onMouseUp={handleThemEnd}
              onMouseLeave={handleThemEnd}
              onTouchStart={handleThemStart}
              onTouchEnd={handleThemEnd}
              onTouchCancel={handleThemEnd}
            >
              Them
            </span>
            <span 
              className="glow-yellow animate-flicker-extremely-slow-single select-none"
              onMouseDown={handleAnywhereStart}
              onMouseUp={handleAnywhereEnd}
              onMouseLeave={handleAnywhereEnd}
              onTouchStart={handleAnywhereStart}
              onTouchEnd={handleAnywhereEnd}
              onTouchCancel={handleAnywhereEnd}
            >
              Anywhere
            </span>
          </div>
        </div>
      </div>



      {/* Browse Categories */}
      <div className="text-center mb-2 landscape:mb-1">
        <div className="flex items-center justify-center space-x-2">
          <div className="text-yellow-400 text-lg font-bold font-audiowide animate-flicker-fast opacity-70">
            Browse
          </div>
          <span className="text-yellow-400 text-lg font-bold font-audiowide animate-flicker-slow">Categories</span>
        </div>
      </div>

      {/* Category Buttons */}
      <div 
        className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'pan-x'
        }}
      >
        {["90's Cartoons", "Animated Series", "Animals", "Anime", "Cars", "Christian", "Disney", "Dragons", "Fashion", "Flowers", "Food & Drink", "Gaming", "Hello Kitty", "Kawaii", "Hispanic", "Marijuana", "Memes", "Movies", "Musicians", "Pokemon", "Sports", "Psychedelic", "Trump", "TV Shows", "Unicorns"].map((cat) => {
          const href = cat === "Flowers" ? "/flowers" : cat === "Fashion" ? "/fashion" : cat === "Kawaii" ? "/kawaii" : cat === "Hello Kitty" ? "/hellokitty" : cat === "Marijuana" ? "/marijuana" : cat === "Trump" ? "/trump" : cat === "Hispanic" ? "/hispanic" : cat === "Pokemon" ? "/pokemon" : cat === "Animated Series" ? "/animatedseries" : cat === "Food & Drink" ? "/food-drink" : cat === "Psychedelic" ? "/trip" : cat === "90's Cartoons" ? "/" : cat === "Disney" ? "/disney" : cat === "Unicorns" ? "/unicorns" : cat === "Dragons" ? "/dragons" : cat === "Musicians" ? "/musicians" : `/${cat.toLowerCase().replace(/\s/g, '')}`;
        
        
          return (
            <Link key={cat} href={href}>
              <button 
                className={`inline-block rounded-full ${cat === "Trump" ? "relative overflow-hidden" : cat === "Christian" ? "bg-yellow-400" : cat === "Fashion" ? "relative overflow-hidden" : cat === "Flowers" ? "bg-pink-300" : cat === "Kawaii" ? "bg-purple-500" : cat === "Hello Kitty" ? "bg-neon-pink" : cat === "Unicorns" ? "bg-pink-400" : cat === "Dragons" ? "bg-red-600" : cat === "Marijuana" ? "relative overflow-hidden" : cat === "Hispanic" ? "bg-orange-500" : cat === "Pokemon" ? "bg-neon-yellow" : cat === "Disney" ? "bg-blue-400" : cat === "Psychedelic" ? "relative overflow-hidden" : cat === "Musicians" ? "" : cat === "Cars" ? "" : "bg-neon-aqua"} px-4 py-2 mx-1 font-montserrat`}
                style={cat === "Trump" ? { 
                  color: 'black',
                  background: 'linear-gradient(180deg, #b22234 0%, #b22234 15%, white 15%, white 30%, #b22234 30%, #b22234 45%, white 45%, white 60%, #b22234 60%, #b22234 75%, white 75%, white 90%, #b22234 90%)',
                  position: 'relative',
                  paddingRight: '2rem'
                } : cat === "Fashion" ? {
                  color: '#c3a343',
                  backgroundColor: 'black',
                  border: '2px solid #c3a343',
                  boxShadow: '0 0 10px #c3a343',
                  textShadow: '0 0 5px #c3a343'
                } : cat === "Psychedelic" ? { 
                  color: 'black',
                  background: 'linear-gradient(45deg, #ff0080, #00ff80, #8000ff, #ff8000, #0080ff)',
                  backgroundSize: '400% 400%',
                  animation: 'trip-gradient 3s ease infinite'
                } : cat === "Christian" ? { color: 'black', backgroundColor: '#FFD700' } : cat === "Pokemon" ? {
                  color: 'black',
                  background: 'linear-gradient(180deg, #ff0000 0%, #ff0000 45%, #000000 45%, #000000 55%, #ffffff 55%, #ffffff 100%)',
                  border: '2px solid black',
                  position: 'relative',
                  overflow: 'hidden'
                } : cat === "Hello Kitty" ? { color: 'black' } : cat === "Kawaii" ? { color: 'black', backgroundColor: '#a855f7' } : cat === "Flowers" ? { color: 'black', backgroundColor: '#f9a8d4' } : cat === "Marijuana" ? {
                  color: 'white',
                  background: 'radial-gradient(circle at center, #2d5a27 0%, #1e3d1a 40%, #0f1f0d 100%)',
                  boxShadow: 'inset 0 0 10px #4ade80, 0 0 5px #a855f7',
                  border: '1px solid #2d5a27',
                  textShadow: '0 0 3px #fff, 0 0 10px #4ade80'
                } : cat === "Musicians" ? {
                  color: 'black',
                  backgroundColor: '#e879f9',
                  boxShadow: '0 0 8px #e879f9aa'
                } : cat === "Cars" ? {
                  color: 'black',
                  backgroundColor: '#f97316',
                  boxShadow: '0 0 8px #f97316aa'
                } : { color: 'black' }}
              >
                {cat === "Pokemon" && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-black rounded-full z-10"></div>
                )}
                {cat === "Fashion" && (
                  <div className="absolute inset-0 opacity-20 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-0.5 bg-[#c3a343] absolute top-1/4"></div>
                    <div className="w-full h-0.5 bg-[#c3a343] absolute bottom-1/4"></div>
                  </div>
                )}
                {cat === "Marijuana" && (
                  <div className="absolute inset-0 pointer-events-none opacity-60">
                    {/* Purple hairs */}
                    <div className="absolute top-1 left-2 w-0.5 h-3 bg-purple-500 rotate-45 rounded-full"></div>
                    <div className="absolute bottom-2 right-4 w-0.5 h-4 bg-purple-400 -rotate-12 rounded-full"></div>
                    <div className="absolute top-4 right-1 w-0.5 h-2 bg-purple-600 rotate-[60deg] rounded-full"></div>
                    {/* Red hairs */}
                    <div className="absolute top-2 left-6 w-0.5 h-3 bg-red-500 -rotate-12 rounded-full"></div>
                    <div className="absolute bottom-4 left-2 w-0.5 h-2 bg-red-600 rotate-45 rounded-full"></div>
                    {/* Orange hairs */}
                    <div className="absolute top-6 right-8 w-0.5 h-3 bg-orange-500 rotate-12 rounded-full"></div>
                    <div className="absolute bottom-1 right-2 w-0.5 h-2 bg-orange-400 -rotate-[30deg] rounded-full"></div>
                    {/* White hairs (trichomes) */}
                    <div className="absolute top-2 right-6 w-0.5 h-2 bg-white/80 rotate-12 rounded-full"></div>
                    <div className="absolute bottom-1 left-5 w-0.5 h-3 bg-white/70 -rotate-45 rounded-full"></div>
                    <div className="absolute top-1/2 left-1 w-0.5 h-2 bg-white/90 rotate-90 rounded-full"></div>
                  </div>
                )}
                {cat}
              </button>
            </Link>
          );
        })}
      </div>

      {/* Sticker Squares */}
      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">
            {["90's Cartoons", "Animated Series", "Animals", "Anime", "Cars", "Christian", "Disney", "Dragons", "Fashion", "Flowers", "Food & Drink", "Gaming", "Hello Kitty", "Kawaii", "Hispanic", "Marijuana", "Memes", "Movies", "Musicians", "Pokemon", "Sports", "Psychedelic", "Trump", "TV Shows", "Unicorns"].map((cat, i) => (
              <div key={i} className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 neon-border-cyan flex items-center justify-center">
                <div className="flex items-center justify-center w-full h-full">
                  <span className="text-gray-500">{cat}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}