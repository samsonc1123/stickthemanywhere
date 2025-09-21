import type { CategoryData, Sticker, Subcategory } from '../types/sticker';
import { allCategories } from '../stickers/categories';

/**
 * CategoryManager - Centralized utility for managing category data
 */
export class CategoryManager {
  /**
   * Get category data by key
   */
  static getCategory(key: string): CategoryData | undefined {
    return allCategories[key as keyof typeof allCategories];
  }

  /**
   * Get all available categories
   */
  static getAllCategories(): Record<string, CategoryData> {
    return allCategories;
  }

  /**
   * Get subcategories for a specific category
   */
  static getSubcategories(categoryKey: string): Subcategory[] {
    const category = this.getCategory(categoryKey);
    return category?.subcategories || [];
  }

  /**
   * Get stickers for a specific subcategory
   */
  static getStickersForSubcategory(categoryKey: string, subcategoryName: string): Sticker[] {
    const category = this.getCategory(categoryKey);
    if (!category) return [];

    const subcategoryIndex = category.subcategories.findIndex(
      sub => sub.name === subcategoryName
    );
    
    if (subcategoryIndex === -1 || !category.stickerCollections[subcategoryIndex]) {
      return [];
    }

    return category.stickerCollections[subcategoryIndex];
  }

  /**
   * Add stickers to a subcategory
   */
  static addStickersToSubcategory(
    categoryKey: string, 
    subcategoryName: string, 
    stickers: Sticker[]
  ): boolean {
    const category = this.getCategory(categoryKey);
    if (!category) return false;

    const subcategoryIndex = category.subcategories.findIndex(
      sub => sub.name === subcategoryName
    );
    
    if (subcategoryIndex === -1) return false;

    if (!category.stickerCollections[subcategoryIndex]) {
      category.stickerCollections[subcategoryIndex] = [];
    }

    category.stickerCollections[subcategoryIndex].push(...stickers);
    return true;
  }

  /**
   * Get total sticker count for a category
   */
  static getTotalStickerCount(categoryKey: string): number {
    const category = this.getCategory(categoryKey);
    if (!category) return 0;

    return category.stickerCollections.reduce((total, collection) => {
      return total + (collection?.length || 0);
    }, 0);
  }
}