import React, { useState } from 'react';
import { StickerEffectsToggle } from './StickerEffectsToggle';

export function EffectsButton() {
  const [showToggle, setShowToggle] = useState(false);

  return (
    <>
      {/* Floating Effects Button */}
      <button
        onClick={() => setShowToggle(!showToggle)}
        className="fixed bottom-4 right-4 z-40 bg-neon-aqua text-black p-3 rounded-full shadow-lg hover:scale-110 transition-transform font-bold"
      >
        🎨
      </button>

      {/* Toggle Menu */}
      <StickerEffectsToggle 
        isVisible={showToggle} 
        onClose={() => setShowToggle(false)} 
      />
    </>
  );
}