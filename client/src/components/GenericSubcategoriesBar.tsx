import React from 'react';

interface Subcategory {
  name: string;
  color: string;
}

interface GenericSubcategoriesBarProps {
  subcategories: Subcategory[];
  onSubcategoryClick?: (subcategory: string) => void;
  className?: string;
}

export default function GenericSubcategoriesBar({ 
  subcategories, 
  onSubcategoryClick,
  className = ""
}: GenericSubcategoriesBarProps) {
  return (
    <div className={`flex justify-start mb-2 landscape:mb-1 w-full relative ${className}`}>
      <div
        className="overflow-x-scroll overflow-y-hidden whitespace-nowrap pl-4 pr-4 py-2 w-full auto-hide-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
      >
        {subcategories.map((sub, i) => (
          <button
            key={i}
            className={`inline-block rounded-full ${sub.color} px-4 py-2 mx-1 hover:scale-105 transition-transform font-montserrat`}
            style={{ color: 'black' }}
            onClick={() => onSubcategoryClick?.(sub.name)}
            data-testid={`button-subcategory-${sub.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {sub.name}
          </button>
        ))}
      </div>
    </div>
  );
}