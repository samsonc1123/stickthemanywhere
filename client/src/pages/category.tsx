import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { X, ShoppingCart } from "lucide-react";

interface Sticker {
  id: number;
  name: string;
  slug: string;
  image: string;
  price: number;
  categoryId: number;
  subcategoryId: number;
}

interface Subcategory {
  id: number;
  name: string;
  slug: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  subcategories: Subcategory[];
}

interface AddToCartPopupProps {
  sticker: Sticker;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (sticker: Sticker) => void;
}

function AddToCartPopup({ sticker, isOpen, onClose, onAddToCart }: AddToCartPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-dark-gray border-2 border-neon-blue rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="text-center">
          <img
            src={sticker.image}
            alt={sticker.name}
            className="w-32 h-32 mx-auto mb-4 rounded-lg border border-neon-blue object-cover"
          />
          
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => {
                onAddToCart(sticker);
                onClose();
              }}
              className="bg-white text-black hover:bg-gray-200 transition-colors px-6 py-3 rounded-lg border-2 border-white hover:border-neon-blue hover:shadow-lg hover:shadow-neon-blue/50"
            >
              <ShoppingCart className="h-5 w-5" />
            </Button>
            
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 px-6 py-3"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CategoryPage() {
  const params = useParams();
  const categorySlug = params.category as string;
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const { data: category, isLoading: isCategoryLoading } = useQuery<Category>({
    queryKey: ['/api/categories', categorySlug],
    enabled: !!categorySlug,
  });

  const { data: stickers = [], isLoading: isStickersLoading } = useQuery<Sticker[]>({
    queryKey: ['/api/stickers/category', categorySlug],
    enabled: !!categorySlug,
  });

  const filteredStickers = selectedSubcategory
    ? stickers.filter(sticker => {
        const subcategory = category?.subcategories.find(sub => sub.slug === selectedSubcategory);
        return subcategory && sticker.subcategoryId === subcategory.id;
      })
    : stickers;

  const handleStickerClick = (sticker: Sticker) => {
    setSelectedSticker(sticker);
    setIsPopupOpen(true);
  };

  const handleAddToCart = (sticker: Sticker) => {
    // TODO: Implement cart functionality
    console.log('Adding to cart:', sticker);
  };

  if (isCategoryLoading || isStickersLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-white">Loading...</div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-white">Category not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Category Header */}
      <div className="text-center mb-8">
        <h1 className={`text-4xl font-bold text-${category.color} mb-2`}>
          {category.name}
        </h1>
      </div>

      {/* Subcategory Navigation Bar */}
      <div className="mb-8">
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-neon-blue">
          <Button
            onClick={() => setSelectedSubcategory(null)}
            variant={selectedSubcategory === null ? "default" : "outline"}
            className={`flex-shrink-0 px-6 py-3 rounded-full transition-all duration-300 ${
              selectedSubcategory === null
                ? `bg-${category.color} text-black border-2 border-${category.color} shadow-lg shadow-${category.color}/50`
                : `text-${category.color} border-${category.color} hover:bg-${category.color} hover:text-black`
            }`}
          >
            All
          </Button>
          
          {category.subcategories.map((subcategory) => (
            <Button
              key={subcategory.id}
              onClick={() => setSelectedSubcategory(subcategory.slug)}
              variant={selectedSubcategory === subcategory.slug ? "default" : "outline"}
              className={`flex-shrink-0 px-6 py-3 rounded-full transition-all duration-300 ${
                selectedSubcategory === subcategory.slug
                  ? `bg-${category.color} text-black border-2 border-${category.color} shadow-lg shadow-${category.color}/50`
                  : `text-${category.color} border-${category.color} hover:bg-${category.color} hover:text-black`
              }`}
            >
              {subcategory.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Stickers Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredStickers.map((sticker) => (
          <div
            key={sticker.id}
            onClick={() => handleStickerClick(sticker)}
            className="aspect-square bg-light-gray rounded-lg overflow-hidden border-2 border-transparent hover:border-neon-blue transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-neon-blue/50 transform hover:scale-105"
          >
            <img
              src={sticker.image}
              alt={sticker.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {/* No stickers message */}
      {filteredStickers.length === 0 && (
        <div className="text-center text-gray-400 mt-12">
          <p>No stickers found in this category.</p>
          {selectedSubcategory && (
            <Button
              onClick={() => setSelectedSubcategory(null)}
              variant="outline"
              className="mt-4 text-neon-blue border-neon-blue hover:bg-neon-blue hover:text-black"
            >
              View All Stickers
            </Button>
          )}
        </div>
      )}

      {/* Add to Cart Popup */}
      {selectedSticker && (
        <AddToCartPopup
          sticker={selectedSticker}
          isOpen={isPopupOpen}
          onClose={() => setIsPopupOpen(false)}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}