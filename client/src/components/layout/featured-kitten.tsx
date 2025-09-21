import catStickerPath from "@assets/generated_images/Cute_neon_cat_sticker_b705b868.png";

export function FeaturedKitten() {
  return (
    <div className="absolute top-4 right-4 md:top-6 md:right-6 w-28 h-28 md:w-36 md:h-36 z-20 cat-bounce">
      {/* This creates a shape-following neon effect with bounce animation */}
      <div className="relative w-full h-full">
        {/* First glow layer - outer glow */}
        <img 
          src={catStickerPath} 
          alt="Outer Glow"
          className="absolute w-full h-full object-contain animate-pulse-slow"
          style={{ 
            filter: "drop-shadow(0 0 8px white) drop-shadow(0 0 15px white)", 
            opacity: 0.7,
            transform: "scale(1.08)"
          }}
        />
        
        {/* Second glow layer - edge tracing */}
        <img 
          src={catStickerPath} 
          alt="Edge Tracing"
          className="absolute w-full h-full object-contain"
          style={{ 
            filter: "drop-shadow(0 0 4px white) drop-shadow(0 0 6px white) brightness(1.3)", 
            opacity: 0.9,
            transform: "scale(1.03)"
          }}
        />
        
        {/* Third glow layer - precise edge highlight */}
        <img 
          src={catStickerPath} 
          alt="Edge Highlight"
          className="absolute w-full h-full object-contain"
          style={{ 
            filter: "drop-shadow(0 0 2px white) drop-shadow(0 0 3px white) contrast(1.2)", 
            opacity: 0.95,
            transform: "scale(1.01)"
          }}
        />
        
        {/* Main sticker image on top */}
        <img 
          src={catStickerPath}
          alt="Featured Sticker" 
          className="relative w-full h-full object-contain z-10"
        />
      </div>
    </div>
  );
}
