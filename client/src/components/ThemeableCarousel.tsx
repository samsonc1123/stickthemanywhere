import React from 'react';

interface Sticker {
  src: string;
  alt: string;
}

interface ThemeableCarouselProps {
  stickers: Sticker[];
  borderColor?: string;
  glowColor?: string;
  textColor?: string;
  theme?: 'cyan' | 'red' | 'orange' | 'green' | 'purple' | 'blue' | 'pink';
}

export default function ThemeableCarousel({ 
  stickers, 
  borderColor,
  glowColor,
  textColor,
  theme = 'cyan'
}: ThemeableCarouselProps) {
  // Define theme-based styles
  const themeStyles = {
    cyan: 'border-4 neon-border-cyan',
    red: 'border-4',
    orange: 'border-4',
    green: 'border-4',
    purple: 'border-4',
    blue: 'border-4',
    pink: 'border-4'
  };

  const themeColors = {
    cyan: { border: '#00ffff', glow: '#00ffff' },
    red: { border: '#ef4444', glow: '#ef4444' },
    orange: { border: '#f97316', glow: '#f97316' },
    green: { border: '#22c55e', glow: '#22c55e' },
    purple: { border: '#a855f7', glow: '#a855f7' },
    blue: { border: '#3b82f6', glow: '#3b82f6' },
    pink: { border: '#ec4899', glow: '#ec4899' }
  };

  const currentTheme = themeColors[theme];
  const finalBorderColor = borderColor || currentTheme.border;
  const finalGlowColor = glowColor || currentTheme.glow;

  return (
    <div 
      className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 flex items-center justify-center"
      style={{
        borderColor: finalBorderColor,
        boxShadow: `0 0 8px ${finalGlowColor}`
      }}
    >
      <div
        className="w-full h-full overflow-x-scroll auto-hide-scrollbar flex items-center"
        style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
      >
        <div className="flex h-full gap-2">
          {stickers.map((sticker, i) => (
            <div key={i} className="flex-shrink-0 w-full h-full flex items-center justify-center">
              <img
                src={sticker.src}
                alt={sticker.alt}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
                decoding="async"
                style={{
                  backgroundColor: 'transparent'
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}