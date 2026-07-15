import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface StickerRow {
  _id: Id<"stickers">;
  code: string;
  name?: string;
  imageUrl: string | null;
  sortOrder?: number;
}

export default function AdminReorder() {
  const [, setLocation] = useLocation();
  const [stickers, setStickers] = useState<StickerRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tapZoneFeedback, setTapZoneFeedback] = useState<string | null>(null);
  const { toast } = useToast();

  const handleTapZone = (target: string) => {
    setTapZoneFeedback(target);
    setTimeout(() => setTapZoneFeedback(null), 200);
    setLocation(target);
  };

  const categories = useQuery(api.categories.getAllCategories) ?? [];
  const categoriesLoading = categories === undefined;
  const subcategories = useQuery(
    api.subcategories.getSubcategoriesByCategory,
    selectedCategory ? { categoryCode: selectedCategory } : "skip"
  ) ?? [];
  const subcategoriesLoading = subcategories === undefined;

  const convexStickers = useQuery(
    api.stickers.getStickersBySubcategory,
    selectedSubcategory ? { subcategoryCode: selectedSubcategory } : "skip"
  );

  const updateSortOrders = useMutation(api.stickers.updateSortOrders);

  const isLoading = convexStickers === undefined && !!selectedSubcategory;

  const handleCategoryChange = (code: string) => {
    setSelectedCategory(code);
    setSelectedSubcategory('');
    setStickers([]);
    setHasChanges(false);
    setLoaded(false);
  };

  const handleSubcategoryChange = (subcatCode: string) => {
    setSelectedSubcategory(subcatCode);
    setStickers([]);
    setHasChanges(false);
    setLoaded(false);
  };

  const handleLoadStickers = () => {
    if (!convexStickers) return;
    setStickers(convexStickers.map(s => ({
      _id: s._id,
      code: s.code,
      name: s.name,
      imageUrl: s.imageUrl ?? null,
      sortOrder: s.sortOrder,
    })));
    setHasChanges(false);
    setLoaded(true);
    toast({ title: `Loaded ${convexStickers.length} stickers` });
  };

  const loadStickers = () => {
    handleLoadStickers();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newStickers = [...stickers];
    const [draggedItem] = newStickers.splice(draggedIndex, 1);
    newStickers.splice(dropIndex, 0, draggedItem);

    setStickers(newStickers);
    setDraggedIndex(null);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const saveOrder = async () => {
    setIsSaving(true);
    try {
      const updates = stickers.map((s, i) => ({ id: s._id, sortOrder: i + 1 }));
      await updateSortOrders({ updates });
      setHasChanges(false);
      toast({ title: `✓ Saved order for ${updates.length} stickers` });
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetOrder = () => {
    loadStickers();
    setHasChanges(false);
  };

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron p-4 overflow-auto relative">
      <div 
        onTouchStart={() => handleTapZone('/admin')}
        onClick={() => handleTapZone('/admin')}
        className={`fixed top-0 left-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === '/admin' ? 'bg-white/40 opacity-100' : 'bg-transparent opacity-0 hover:bg-white/5'}`}
        title="Admin Dugout"
        style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
      />
      <div 
        onTouchStart={() => handleTapZone('/admin/uploader')}
        onClick={() => handleTapZone('/admin/uploader')}
        className={`fixed top-0 right-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === '/admin/uploader' ? 'bg-white/40 opacity-100' : 'bg-transparent opacity-0 hover:bg-white/5'}`}
        title="Code Pipeline"
        style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
      />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="font-cursive font-bold mb-3">
            <div className="flex flex-col items-center landscape:hidden text-3xl">
              <span className="trip-gradient-text">Drag & Drop</span>
              <span className="trip-gradient-text">to Reorder</span>
            </div>
            <div className="hidden landscape:block text-4xl">
              <span className="trip-gradient-text">Drag & Drop to Reorder</span>
            </div>
          </h1>
        </div>

        <div className="border-2 border-fuchsia-500 rounded-lg p-6 mb-6 shadow-lg shadow-fuchsia-500/20 bg-transparent">
          <div className="hidden landscape:flex landscape:items-end landscape:gap-4">
            <div className="flex-1">
              <label className="text-fuchsia-300 text-sm mb-1 block">Category</label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="bg-gray-900/80 border-fuchsia-500/50 text-white">
                  <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.code} value={cat.code}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-fuchsia-300 text-sm mb-1 block">Subcategory</label>
              <Select 
                value={selectedSubcategory} 
                onValueChange={handleSubcategoryChange}
                disabled={!selectedCategory || subcategoriesLoading}
              >
                <SelectTrigger className="bg-gray-900/80 border-fuchsia-500/50 text-white">
                  <SelectValue placeholder={subcategoriesLoading ? "Loading..." : (selectedCategory ? "Select subcategory" : "Select category first")} />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.code} value={sub.code}>
                      {sub.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={handleLoadStickers}
                disabled={!selectedSubcategory || isLoading}
                className="inline-flex items-center justify-center px-4 py-2 rounded-full font-montserrat font-bold text-black relative overflow-hidden whitespace-nowrap disabled:opacity-50 trip-gradient-bg"
              >
                <span className="relative z-10">{isLoading ? '⏳ Loading...' : '⬆ Load Stickers'}</span>
              </button>
            </div>
          </div>

          <div className="landscape:hidden">
            <div className="space-y-4">
              <div>
                <label className="text-fuchsia-300 text-sm mb-1 block">Category</label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="bg-gray-900/80 border-fuchsia-500/50 text-white">
                    <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.code} value={cat.code}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-fuchsia-300 text-sm mb-1 block">Subcategory</label>
                <Select 
                  value={selectedSubcategory} 
                  onValueChange={handleSubcategoryChange}
                  disabled={!selectedCategory || subcategoriesLoading}
                >
                  <SelectTrigger className="bg-gray-900/80 border-fuchsia-500/50 text-white">
                    <SelectValue placeholder={subcategoriesLoading ? "Loading..." : (selectedCategory ? "Select subcategory" : "Select category first")} />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub.code} value={sub.code}>
                        {sub.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="h-px w-full bg-fuchsia-500/30 my-4"></div>
            
            <div className="flex justify-center">
              <button
                onClick={handleLoadStickers}
                disabled={!selectedSubcategory || isLoading}
                className="inline-flex items-center justify-center px-4 py-2 rounded-full font-montserrat font-bold text-black relative overflow-hidden whitespace-nowrap disabled:opacity-50 trip-gradient-bg"
              >
                <span className="relative z-10">{isLoading ? '⏳ Loading...' : '⬆ Load Stickers'}</span>
              </button>
            </div>
          </div>

          {hasChanges && (
            <div className="flex gap-3 justify-center mt-4">
              <Button
                onClick={saveOrder}
                disabled={isSaving}
                className="bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-bold px-8 shadow-lg shadow-fuchsia-500/30"
              >
                {isSaving ? 'Saving...' : '💾 Save New Order'}
              </Button>
              <Button
                onClick={loadStickers}
                disabled={isSaving}
                variant="outline"
                className="border-gray-500 text-gray-300 hover:bg-gray-800"
              >
                ↩ Undo Changes
              </Button>
            </div>
          )}

          {stickers.length > 0 && !hasChanges && (
            <div className="flex justify-center mt-4">
              <Button
                onClick={resetOrder}
                disabled={isSaving}
                variant="outline"
                className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
              >
                🔄 Reset Order
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-fuchsia-400 animate-pulse text-xl">Loading stickers...</div>
          </div>
        ) : stickers.length === 0 && selectedSubcategory ? (
          <div className="text-center py-12 text-gray-500">
            No stickers found
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {stickers.map((sticker, index) => (
              <div
                key={sticker._id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`
                  relative cursor-grab active:cursor-grabbing
                  bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
                  border-2 rounded-lg p-2 transition-all duration-200
                  ${draggedIndex === index
                    ? 'border-yellow-400 shadow-lg shadow-yellow-400/50 scale-105 opacity-70'
                    : 'border-fuchsia-500/40 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/30'}
                `}
              >
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-black z-10">
                  {index + 1}
                </div>
                <div className="aspect-square bg-black/50 rounded mb-2 flex items-center justify-center overflow-hidden">
                  {sticker.imageUrl ? (
                    <img
                      src={sticker.imageUrl}
                      alt={sticker.name || sticker.code}
                      className="max-w-full max-h-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-gray-600 text-xs">No image</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-cyan-400 text-xs font-mono truncate">{sticker.code}</p>
                  <p className="text-gray-400 text-xs truncate">{sticker.name || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
