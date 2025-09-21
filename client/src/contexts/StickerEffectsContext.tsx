import React, { createContext, useContext, useState, ReactNode } from 'react';

export type StickerEffect = 'border' | 'plain' | 'comic' | 'shiny';

interface StickerEffectsContextType {
  currentEffect: StickerEffect;
  setCurrentEffect: (effect: StickerEffect) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

const StickerEffectsContext = createContext<StickerEffectsContextType | undefined>(undefined);

export function StickerEffectsProvider({ children }: { children: ReactNode }) {
  const [currentEffect, setCurrentEffect] = useState<StickerEffect>('border');
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <StickerEffectsContext.Provider value={{
      currentEffect,
      setCurrentEffect,
      isProcessing,
      setIsProcessing
    }}>
      {children}
    </StickerEffectsContext.Provider>
  );
}

export function useStickerEffects() {
  const context = useContext(StickerEffectsContext);
  if (context === undefined) {
    throw new Error('useStickerEffects must be used within a StickerEffectsProvider');
  }
  return context;
}