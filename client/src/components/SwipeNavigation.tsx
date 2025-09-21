import { useState, useRef, useEffect } from "react";

interface SwipeNavigationProps {
  children: React.ReactElement[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  className?: string;
}

export default function SwipeNavigation({ 
  children, 
  currentIndex, 
  onIndexChange, 
  className = "" 
}: SwipeNavigationProps) {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number) => {
    setStartX(clientX);
    setCurrentX(clientX);
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    setCurrentX(clientX);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    
    const deltaX = currentX - startX;
    const threshold = 50; // Minimum swipe distance
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - go to previous
        onIndexChange(currentIndex - 1);
      } else if (deltaX < 0 && currentIndex < children.length - 1) {
        // Swipe left - go to next
        onIndexChange(currentIndex + 1);
      }
    }
    
    setIsDragging(false);
    setStartX(0);
    setCurrentX(0);
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Mouse events for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  const translateX = isDragging ? currentX - startX : 0;
  const baseTransform = `translateX(-${currentIndex * 100}%)`;
  const dragTransform = isDragging ? `translateX(${translateX}px)` : '';

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={isDragging ? handleMouseMove : undefined}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        className={`flex transition-transform duration-300 ${isDragging ? '' : 'ease-out'}`}
        style={{ 
          transform: `${baseTransform} ${dragTransform}`,
          width: `${children.length * 100}%`
        }}
      >
        {children.map((child, index) => (
          <div 
            key={index} 
            className="w-full flex-shrink-0"
            style={{ width: `${100 / children.length}%` }}
          >
            {child}
          </div>
        ))}
      </div>
      
      {/* Indicator dots */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {children.map((_, index) => (
          <button
            key={index}
            onClick={() => onIndexChange(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex 
                ? 'bg-neon-pink' 
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}