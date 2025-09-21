import React, { useState, useEffect } from 'react';
import { useStickerEffects, StickerEffect } from '@/contexts/StickerEffectsContext';
import { geminiImageService } from '@/services/geminiService';

interface SmartStickerProps {
  originalImageUrl: string;
  alt?: string;
  className?: string;
  index?: number;
  onClick?: () => void;
}

export function SmartSticker({ 
  originalImageUrl, 
  alt = 'Sticker', 
  className = '', 
  index = 0,
  onClick 
}: SmartStickerProps) {
  const { currentEffect } = useStickerEffects();
  const [processedImageUrl, setProcessedImageUrl] = useState(originalImageUrl);
  const [isLoading, setIsLoading] = useState(false);

  // CSS filter effects for immediate visual feedback
  const getFilterEffects = (effect: StickerEffect): string => {
    switch (effect) {
      case 'plain':
        return 'brightness(1.1) contrast(1.1) drop-shadow(0 0 5px rgba(255,255,255,0.3))';
      case 'border':
        return 'none';
      case 'comic':
        return 'contrast(1.5) saturate(1.8) brightness(1.2) drop-shadow(2px 2px 0px #000)';
      case 'shiny':
        return 'brightness(1.4) contrast(1.2) saturate(1.3) drop-shadow(0 0 10px rgba(255,255,255,0.8))';
      default:
        return 'none';
    }
  };

  const getBorderStyle = (effect: StickerEffect) => {
    switch (effect) {
      case 'plain':
        return { 
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'transparent'
        };
      case 'border':
        return {}; // Keep existing border
      case 'comic':
        return { 
          border: '5px solid #000',
          borderRadius: '15px',
          background: 'linear-gradient(45deg, #ff4444, #44ff44, #4444ff)',
          transform: 'scale(1.05)'
        };
      case 'shiny':
        return {
          border: '4px solid rgba(255,255,255,1)',
          borderRadius: '12px',
          background: `
            linear-gradient(135deg, 
              rgba(255,255,255,0.8) 0%, 
              rgba(200,220,255,0.6) 25%, 
              rgba(255,255,255,0.9) 50%, 
              rgba(220,200,255,0.6) 75%, 
              rgba(255,255,255,0.8) 100%
            )
          `,
          boxShadow: `
            0 0 30px rgba(255,255,255,0.8), 
            inset 0 0 30px rgba(255,255,255,0.5),
            0 5px 15px rgba(255,255,255,0.4),
            inset 5px 5px 20px rgba(255,255,255,0.3)
          `,
          transform: 'scale(1.03)',
          position: 'relative' as const
        };
      default:
        return {};
    }
  };

  // Future AI processing (commented out for now - using CSS effects instead)
  useEffect(() => {
    // For now, we'll use CSS effects for immediate response
    // In the future, this would trigger AI processing:
    /*
    if (originalImageUrl && currentEffect !== 'border') {
      setIsLoading(true);
      geminiImageService.processImageWithEffect(originalImageUrl, currentEffect)
        .then(processedUrl => {
          setProcessedImageUrl(processedUrl);
        })
        .catch(error => {
          console.error('Error processing image:', error);
          setProcessedImageUrl(originalImageUrl);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setProcessedImageUrl(originalImageUrl);
    }
    */
    setProcessedImageUrl(originalImageUrl);
  }, [originalImageUrl, currentEffect]);

  return (
    <div
      className={`relative ${className}`}
      style={{
        filter: getFilterEffects(currentEffect),
        ...getBorderStyle(currentEffect),
        transition: 'all 0.3s ease'
      }}
      onClick={onClick}
    >
      {/* Loading overlay for future AI processing */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded">
          <div className="text-white text-xs">Processing...</div>
        </div>
      )}
      
      {/* Actual image display */}
      {originalImageUrl ? (
        <img 
          src={processedImageUrl} 
          alt={alt}
          className="w-full h-full object-contain rounded"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded">
          <span className="text-gray-400">Sticker {index + 1}</span>
        </div>
      )}
      
      {/* Effect indicator */}
      {currentEffect !== 'border' && (
        <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
          {currentEffect}
        </div>
      )}
    </div>
  );
}