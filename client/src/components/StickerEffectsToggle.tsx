import React from 'react';
import { useStickerEffects, StickerEffect } from '@/contexts/StickerEffectsContext';

const effectOptions: { value: StickerEffect; label: string; icon: string }[] = [
  { value: 'border', label: 'Original', icon: '🔲' },
  { value: 'plain', label: 'Plain', icon: '⚪' },
  { value: 'comic', label: 'Comic', icon: '💥' },
  { value: 'shiny', label: 'Shiny', icon: '✨' }
];

interface StickerEffectsToggleProps {
  isVisible: boolean;
  onClose: () => void;
}

export function StickerEffectsToggle({ isVisible, onClose }: StickerEffectsToggleProps) {
  const { currentEffect, setCurrentEffect, isProcessing } = useStickerEffects();

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/90 backdrop-blur-sm rounded-2xl p-2 border border-gray-600">
      <div className="flex gap-2">
        {effectOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              setCurrentEffect(option.value);
              onClose(); // Close after selection
            }}
            disabled={isProcessing}
            className={`
              flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 font-montserrat text-xs
              ${currentEffect === option.value 
                ? 'bg-neon-aqua text-black font-bold' 
                : 'text-white hover:bg-gray-700'
              }
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-xl">{option.icon}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}