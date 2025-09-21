import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { StickerCard } from "@/components/products/sticker-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/hooks/use-categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Helmet } from "react-helmet";

export default function Products() {
  const { category, subcategory } = useParams();
  const [location, setLocation] = useLocation();
  const { categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(category || null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(subcategory || null);

  // Get subcategories based on selected category
  const subcategories = selectedCategory 
    ? categories.find(c => c.slug === selectedCategory)?.subcategories || []
    : [];

  // Query stickers based on filters
  const queryKey = selectedCategory
    ? selectedSubcategory
      ? [`/api/stickers/category/${selectedCategory}/subcategory/${selectedSubcategory}`]
      : [`/api/stickers/category/${selectedCategory}`]
    : ['/api/stickers'];
  
  const { data: stickers, isLoading } = useQuery({
    queryKey,
  });

  // Handle category selection
  const handleCategorySelect = (categorySlug: string) => {
    if (selectedCategory === categorySlug) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setLocation('/products');
    } else {
      setSelectedCategory(categorySlug);
      setSelectedSubcategory(null);
      setLocation(`/products/${categorySlug}`);
    }
  };

  // Handle subcategory selection
  const handleSubcategorySelect = (subcategorySlug: string) => {
    if (selectedSubcategory === subcategorySlug) {
      setSelectedSubcategory(null);
      setLocation(`/products/${selectedCategory}`);
    } else {
      setSelectedSubcategory(subcategorySlug);
      setLocation(`/products/${selectedCategory}/${subcategorySlug}`);
    }
  };

  // Back to categories
  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setLocation('/products');
  };

  // Get page title
  const getPageTitle = () => {
    if (selectedCategory && selectedSubcategory) {
      const catName = categories.find(c => c.slug === selectedCategory)?.name;
      const subName = categories
        .find(c => c.slug === selectedCategory)
        ?.subcategories.find(s => s.slug === selectedSubcategory)?.name;
      return `${subName} ${catName} Stickers`;
    }
    if (selectedCategory) {
      const catName = categories.find(c => c.slug === selectedCategory)?.name;
      return `${catName} Stickers`;
    }
    return "All Stickers";
  };

  return (
    <>
      <Helmet>
        <title>{getPageTitle()} - StickThemAnywhere</title>
        <meta 
          name="description" 
          content={`Browse our collection of ${getPageTitle().toLowerCase()}. High-quality vinyl, waterproof and UV resistant perfect for laptops, water bottles, and more.`} 
        />
      </Helmet>
      
      <div className="container mx-auto p-4 pt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-6">{getPageTitle()}</h1>
          
          {/* Category selector - Only show when no category is selected */}
          {!selectedCategory && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white mb-2">Categories</h2>
              <div className="flex flex-wrap gap-3">
                {categories.map((category, index) => {
                  // Alternate between pink and blue for category buttons
                  const colorClass = index % 2 === 0 ? "neon-pink" : "neon-blue";
                  // Text color depends on the button color - white for pink, black for blue
                  const textColorClass = colorClass === "neon-pink" ? "text-white" : "text-black";
                  
                  return (
                    <div
                      key={category.id}
                      onClick={() => handleCategorySelect(category.slug)}
                      className={`category-pill whitespace-nowrap px-6 py-3 text-lg rounded-full cursor-pointer border-2 
                        bg-${colorClass} ${textColorClass} font-semibold`}
                    >
                      {category.name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Back button - show when category is selected */}
          {selectedCategory && (
            <div className="mb-4">
              <button 
                onClick={handleBackToCategories}
                className="text-white hover:text-neon-pink transition-colors mb-2"
              >
                ← Back to Categories
              </button>
            </div>
          )}
          
          {/* Subcategory filters - shown horizontally scrollable when a category is selected */}
          {selectedCategory && subcategories.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-2">
                {selectedCategory === 'animals' ? 'Animal Types' : 'Subcategories'}
              </h2>
              <div className="flex overflow-x-auto pb-2 gap-3 hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
                {subcategories.map((subcategory, index) => {
                  // Alternate between pink and blue for subcategory badges
                  const colorClass = index % 2 === 0 ? "neon-pink" : "neon-blue";
                  // Text color depends on the button color - white for pink, black for blue
                  const textColorClass = colorClass === "neon-pink" ? "text-white" : "text-black";
                  
                  return (
                    <div
                      key={subcategory.id}
                      className={`cursor-pointer category-pill px-5 py-2 rounded-full text-lg whitespace-nowrap
                        ${selectedSubcategory === subcategory.slug 
                          ? `bg-${colorClass} border-${colorClass} ${textColorClass} font-bold` 
                          : `bg-${colorClass} bg-opacity-80 hover:bg-opacity-100 border-${colorClass} border-2 ${textColorClass}`
                        }`}
                      onClick={() => handleSubcategorySelect(subcategory.slug)}
                    >
                      {subcategory.name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Active filters */}
          {(selectedCategory || selectedSubcategory) && (
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Active filters:</span>
                {selectedCategory && (
                  <Badge 
                    variant="secondary" 
                    className="bg-neon-pink bg-opacity-20 text-white flex items-center gap-1 border-neon-pink"
                  >
                    {categories.find(c => c.slug === selectedCategory)?.name}
                    <button 
                      className="ml-1 text-xs"
                      onClick={() => setSelectedCategory(null)}
                    >
                      ✕
                    </button>
                  </Badge>
                )}
                {selectedSubcategory && (
                  <Badge 
                    variant="secondary" 
                    className="bg-neon-blue bg-opacity-20 text-black flex items-center gap-1 border-neon-blue"
                  >
                    {categories
                      .find(c => c.slug === selectedCategory)
                      ?.subcategories.find(s => s.slug === selectedSubcategory)?.name}
                    <button 
                      className="ml-1 text-xs"
                      onClick={() => setSelectedSubcategory(null)}
                    >
                      ✕
                    </button>
                  </Badge>
                )}
                {(selectedCategory || selectedSubcategory) && (
                  <Button 
                    variant="link" 
                    className="text-neon-blue text-sm p-0 h-auto"
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedSubcategory(null);
                    }}
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Stickers grid - iPhone-style gallery */}
        <div className="products-gallery overflow-x-hidden">
          {isLoading ? (
            // Loading skeletons
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array(12).fill(0).map((_, index) => (
                <div key={index} className="bg-dark-gray rounded-xl overflow-hidden">
                  <Skeleton className="aspect-square w-full bg-light-gray" />
                  <div className="p-4">
                    <Skeleton className="h-4 w-20 mb-2 bg-light-gray" />
                    <Skeleton className="h-5 w-32 mb-1 bg-light-gray" />
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-5 w-16 bg-light-gray" />
                      <Skeleton className="h-4 w-12 bg-light-gray" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : stickers && Array.isArray(stickers) && stickers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {stickers.map((sticker: any) => (
                <div key={sticker.id} className="transform transition-all duration-300 hover:scale-105">
                  <StickerCard sticker={sticker} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl text-white mb-2">No stickers found</h3>
              <p className="text-gray-400">Try changing your filters or check back later!</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
