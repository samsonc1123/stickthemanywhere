import React from 'react';

interface Sticker {
  src: string;
  alt: string;
}

interface StickerCarouselProps {
  stickers: Sticker[];
}

export default function StickerCarousel({ stickers }: StickerCarouselProps) {
  return (
    <div className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center">
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