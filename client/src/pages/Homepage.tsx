import { Link } from 'wouter';
import johnnyBravoSticker from '@assets/IMG_0049_1758331851723.png';

export default function HomePage() {
  return (
    <div className="h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 overflow-hidden">
      {/* Title */}
      <div className="text-center mb-2 landscape:mb-1">
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
        {["90's Cartoons", "Animated Series", "Animals", "Anime", "Cars", "Christian", "Food & Drink", "Gaming", "Hello Kitty", "Hispanic", "Marijuana", "Memes", "Movies", "Pokemon", "Sports", "Psychedelic", "Trump", "TV Shows"].map((cat) => {
          const href = cat === "Hello Kitty" ? "/kawaii" : cat === "Marijuana" ? "/marijuana" : cat === "Trump" ? "/trump" : cat === "Hispanic" ? "/hispanic" : cat === "Pokemon" ? "/pokemon" : cat === "Animated Series" ? "/animatedseries" : cat === "Food & Drink" ? "/food-drink" : cat === "Psychedelic" ? "/trip" : cat === "90's Cartoons" ? "/" : `/${cat.toLowerCase().replace(/\s/g, '')}`;
        
        
          return (
            <Link key={cat} href={href}>
              <button 
                className={`inline-block rounded-full ${cat === "Hello Kitty" ? "bg-neon-pink" : cat === "Marijuana" ? "bg-green-500" : cat === "Trump" ? "bg-red-500" : cat === "Hispanic" ? "bg-orange-500" : cat === "Pokemon" ? "bg-neon-aqua" : cat === "Psychedelic" ? "relative overflow-hidden" : "bg-neon-aqua"} px-4 py-2 mx-1 font-montserrat`}
                style={cat === "Psychedelic" ? { 
                  color: 'black',
                  background: 'linear-gradient(45deg, #ff0080, #00ff80, #8000ff, #ff8000, #0080ff)',
                  backgroundSize: '400% 400%',
                  animation: 'trip-gradient 3s ease infinite'
                } : { color: 'black' }}
              >
                {cat}
              </button>
            </Link>
          );
        })}
      </div>

      {/* Sticker Squares */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center">
                {i === 0 ? (
                  // First box - 90's Cartoons with Johnny Bravo
                  <img 
                    src={johnnyBravoSticker} 
                    alt="Johnny Bravo"
                    className="w-full h-full object-contain p-2"
                  />
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