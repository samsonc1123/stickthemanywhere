import { useState, useEffect } from "react";
import { X, ShoppingCart, Heart, Share2 } from "lucide-react";

interface FullscreenStickerViewProps {
  sticker: {
    id: string;
    name: string;
    imageUrl: string;
    basePrice: string;
    description?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (stickerId: string, customizations?: any) => void;
}

const STICKER_EFFECTS = [
  { id: 'plain', name: 'Plain', description: 'Classic sticker' },
  { id: 'white-outline', name: 'White Outline', description: 'Clean white border' },
  { id: 'comic', name: 'Comic Style', description: 'Bold comic book effect' },
  { id: 'watercolor', name: 'Watercolor', description: 'Soft artistic effect' },
  { id: 'vintage', name: 'Vintage', description: 'Retro aged look' },
  { id: 'neon-glow', name: 'Neon Glow', description: 'Glowing neon effect' }
];

export default function FullscreenStickerView({
  sticker,
  isOpen,
  onClose,
  onAddToCart
}: FullscreenStickerViewProps) {
  const [selectedEffect, setSelectedEffect] = useState('plain');
  const [isLongPress, setIsLongPress] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleLongPressStart = () => {
    const timer = setTimeout(() => {
      setIsLongPress(true);
      // Haptic feedback (if supported)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      // Add to cart with selected effect
      onAddToCart(sticker.id, { effect: selectedEffect });
    }, 500); // 500ms long press
    
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    setTimeout(() => {
      setIsLongPress(false);
    }, 100);
  };

  const handleAddToCartClick = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
    onAddToCart(sticker.id, { effect: selectedEffect });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center">
      <div className="relative w-full h-full max-w-lg mx-auto p-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="flex space-x-2">
            <button className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors">
              <Heart size={20} />
            </button>
            <button className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors">
              <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* Main sticker display */}
        <div className="flex-1 flex items-center justify-center mb-6">
          <div 
            className={`relative select-none transition-transform duration-200 ${
              isLongPress ? 'scale-95' : 'scale-100'
            }`}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
          >
            <img
              src={sticker.imageUrl}
              alt={sticker.name}
              className={`max-w-full max-h-96 object-contain rounded-lg ${
                selectedEffect === 'white-outline' ? 'filter drop-shadow-white' : ''
              } ${
                selectedEffect === 'comic' ? 'filter contrast-125 saturate-150' : ''
              } ${
                selectedEffect === 'watercolor' ? 'filter blur-sm opacity-90' : ''
              } ${
                selectedEffect === 'vintage' ? 'filter sepia-50 contrast-75' : ''
              } ${
                selectedEffect === 'neon-glow' ? 'filter drop-shadow-neon' : ''
              }`}
              style={{
                filter: selectedEffect === 'neon-glow' 
                  ? 'drop-shadow(0 0 10px #ff1493) drop-shadow(0 0 20px #ff1493)' 
                  : selectedEffect === 'white-outline'
                  ? 'drop-shadow(2px 2px 0px white) drop-shadow(-2px -2px 0px white) drop-shadow(2px -2px 0px white) drop-shadow(-2px 2px 0px white)'
                  : undefined
              }}
            />
            
            {/* Long press hint */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-gray-400 text-sm">
              Long press to add to cart
            </div>
          </div>
        </div>

        {/* Sticker info */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{sticker.name}</h2>
          {sticker.description && (
            <p className="text-gray-300 mb-3">{sticker.description}</p>
          )}
          <p className="text-3xl font-bold text-neon-pink">${sticker.basePrice}</p>
        </div>

        {/* Effect selection */}
        <div className="mb-6">
          <h3 className="text-white text-lg font-semibold mb-3">Choose Effect</h3>
          <div className="grid grid-cols-2 gap-2">
            {STICKER_EFFECTS.map((effect) => (
              <button
                key={effect.id}
                onClick={() => setSelectedEffect(effect.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedEffect === effect.id
                    ? 'border-neon-pink bg-neon-pink bg-opacity-20 text-neon-pink'
                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="font-semibold">{effect.name}</div>
                <div className="text-xs opacity-80">{effect.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleAddToCartClick}
            className="flex-1 bg-neon-pink text-black font-bold py-4 px-6 rounded-lg hover:bg-neon-pink-light transition-colors flex items-center justify-center space-x-2"
          >
            <ShoppingCart size={20} />
            <span>Add to Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
}