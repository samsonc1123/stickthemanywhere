import { Link } from "wouter";
import { sortAlphabetically } from '../utils/alphabeticalSort';

const subcategoriesData = [
  { name: "Kermit", color: "bg-neon-aqua" },
  { name: "Mr. Bean", color: "bg-neon-aqua" },
  { name: "Cartoon Baby", color: "bg-neon-aqua" },
  { name: "Troll Internet", color: "bg-neon-aqua" },
  { name: "Grumpy Cat", color: "bg-neon-aqua" },
  { name: "Drake Meme", color: "bg-neon-aqua" },
  { name: "SpongeBob", color: "bg-neon-aqua" },
  { name: "Distracted Boyfriend", color: "bg-neon-aqua" }
];

const subcategories = sortAlphabetically(subcategoriesData);

export default function MemesPage() {

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 pb-16">
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

      {/* Memes Header */}
      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Memes</h1>
      </div>

      {/* Subcategories */}
      <div className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar" 
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
        {subcategories.map((subcat) => (
          <button
            key={subcat.name}
            className={`inline-block rounded-full ${subcat.color} px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform`}
            style={{ 
              color: 'black'
            }}
          >
            {subcat.name}
          </button>
        ))}
      </div>

      {/* Stickers Grid */}
      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">
            {subcategories.map((subcat, i) => (
              <div key={i} className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 neon-border-cyan flex items-center justify-center">
                <div className="flex items-center justify-center w-full h-full">
                  <span className="text-gray-500">{subcat.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}