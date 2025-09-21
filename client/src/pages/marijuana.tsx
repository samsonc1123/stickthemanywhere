import { Link } from "wouter";
import gaLeafSticker from '@assets/4258A55A-325D-4148-84DC-826ACA30EEEA_1756580516651.png';

export default function MarijuanaPage() {
  const subcategories = [
    { name: "Cannabis", color: "bg-green-500" }
  ];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Handle scroll events if needed
  };

  return (
    <div className="h-screen bg-perforated-green text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-2 landscape:mb-1 relative">
        <Link href="/">
          <div className="text-5xl font-cursive font-bold mb-2 cursor-pointer">
            {/* Vertical Layout (Portrait) */}
            <div className="flex flex-col items-start landscape:hidden">
              <span className="glow-green-outline animate-flicker-extremely-slow-single">Weed</span>
              <span className="glow-green-outline animate-flicker-extremely-slow-single">Sticker's</span>
            </div>
            
            {/* Horizontal Layout (Landscape) */}
            <div className="hidden landscape:flex landscape:flex-col landscape:items-start landscape:justify-center landscape:text-4xl">
              <span className="glow-green-outline animate-flicker-extremely-slow-single">Weed</span>
              <span className="glow-green-outline animate-flicker-extremely-slow-single">Sticker's</span>
            </div>
          </div>
        </Link>
      </div>

        {/* Cannabis face sticker - positioned exactly where pink circle indicates */}
        <div 
          className="absolute animate-bounce"
          style={{
            top: '75px',
            right: '45px',
            zIndex: 5
          }}
        >
          <img 
            src="/src/assets/cannabis-face-upright.png"
            alt="Cannabis Face" 
            className="w-16 h-16"
            style={{
              filter: 'drop-shadow(0 0 3px rgba(34, 197, 94, 0.4))',
              transform: 'rotate(30deg)'
            }}
          />
        </div>

      {/* Cannabis Subtitle */}
      <div className="text-center mb-2 landscape:mb-1">
        <div className="flex items-center justify-center space-x-2">
          <span className="text-green-400 text-lg font-bold font-audiowide animate-flicker-slow">Cannabis</span>
        </div>
      </div>

      {/* Cannabis Subcategory */}
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

      {/* Sticker Boxes */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
            <div className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 flex items-center justify-center" style={{borderColor: '#22c55e', boxShadow: '0 0 8px #22c55e'}}>
              <span style={{ color: '#22c55e' }}>Sticker 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}