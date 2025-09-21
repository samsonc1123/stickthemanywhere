import React from 'react';
import CategoryLayout from './CategoryLayout';
import GenericSubcategoriesBar from './GenericSubcategoriesBar';
import StickerCarousel from './StickerCarousel';
import ThemeableCarousel from './ThemeableCarousel';
import type { CategoryData } from '../types/sticker';

interface CategoryPageTemplateProps {
  categoryData: CategoryData;
  onSubcategoryClick?: (subcategory: string) => void;
  theme?: 'cyan' | 'red' | 'orange' | 'green' | 'purple' | 'blue' | 'pink';
  useThemeableCarousel?: boolean;
}

export default function CategoryPageTemplate({ 
  categoryData, 
  onSubcategoryClick,
  theme = 'cyan',
  useThemeableCarousel = false
}: CategoryPageTemplateProps) {
  const CarouselComponent = useThemeableCarousel ? ThemeableCarousel : StickerCarousel;

  return (
    <CategoryLayout categoryTitle={categoryData.title}>
      {/* Subcategories */}
      <GenericSubcategoriesBar 
        subcategories={categoryData.subcategories}
        onSubcategoryClick={onSubcategoryClick}
      />

      {/* Stickers Grid */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-12 landscape:gap-12 max-w-lg landscape:max-w-4xl px-4">
            {categoryData.stickerCollections.map((collection, index) => (
              collection && collection.length > 0 ? (
                <CarouselComponent 
                  key={index}
                  stickers={collection}
                  {...(useThemeableCarousel && { theme })}
                />
              ) : (
                <div
                  key={index}
                  className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center"
                  data-testid={`placeholder-box-${index + 1}`}
                >
                  <span className="text-gray-400">Box {index + 1}</span>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </CategoryLayout>
  );
}