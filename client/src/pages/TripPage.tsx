import { useRef, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import '../styles/HomePage.css';
import { sortAlphabetically } from '../utils/alphabeticalSort';

const subcategoriesData = [
  { name: 'Mushrooms', color: 'bg-trip-morphing' },
  { name: 'Frogs', color: 'bg-trip-morphing' },
  { name: 'Animals', color: 'bg-trip-morphing' },
  { name: 'Aliens', color: 'bg-trip-morphing' },
  { name: 'Words', color: 'bg-trip-morphing' },
  { name: 'Circles', color: 'bg-trip-morphing' },
  { name: 'Squares', color: 'bg-trip-morphing' },
];

const subcategories = sortAlphabetically(subcategoriesData);

export default function TripPage() {
  const [, setLocation] = useLocation();
  const tapTimestamps = useRef<number[]>([]);

  const handleTripleTap = useCallback(() => {
    const now = Date.now();
    tapTimestamps.current = tapTimestamps.current.filter(t => now - t < 800);
    tapTimestamps.current.push(now);
    
    if (tapTimestamps.current.length >= 3) {
      tapTimestamps.current = [];
      setLocation('/admin');
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 pb-16">
      
      {/* Header */}
      <div className="text-center mb-2 landscape:mb-1 relative z-10">
        <div className="text-5xl font-cursive font-bold mb-2">
          {/* Vertical Layout (Portrait) */}
          <div className="flex flex-col items-center landscape:hidden">
            <div className="flex items-center">
              <span className="glow-psychedelic animate-reality-shift">Stick</span>
              <span 
                className="text-trip-morph text-2xl animate-slow-spin inline-block mx-2 select-none cursor-pointer" 
                style={{ fontFamily: 'Pacifico, cursive', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
                onClick={handleTripleTap}
                onContextMenu={(e) => e.preventDefault()}
              >Them</span>
            </div>
            <span className="glow-psychedelic animate-reality-shift">Anywhere</span>
          </div>
          
          {/* Horizontal Layout (Landscape) */}
          <div className="hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-2 landscape:text-4xl">
            <span className="glow-psychedelic animate-reality-shift">Stick</span>
            <span 
              className="text-trip-morph text-xl animate-slow-spin inline-block select-none cursor-pointer" 
              style={{ fontFamily: 'Pacifico, cursive', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
              onClick={handleTripleTap}
              onContextMenu={(e) => e.preventDefault()}
            >Them</span>
            <span className="glow-psychedelic animate-reality-shift">Anywhere</span>
          </div>
        </div>
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
        <Link href="/">
          <button
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 mx-1 hover:scale-105 transition-transform"
            style={{ color: 'white' }}
            data-testid="button-back"
          >
            ←
          </button>
        </Link>
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
      <div className="w-full relative z-10">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">
            {subcategories.map((sub, i) => (
              <div
                key={i}
                className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 neon-border-cyan flex items-center justify-center"
                style={{
                  boxShadow: '0 0 0 1px #ff0080',
                  animation: 'psychedelic-border 4s linear infinite'
                }}
              >
                <div className="flex items-center justify-center w-full h-full">
                  <span className="text-gray-500">{sub.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
