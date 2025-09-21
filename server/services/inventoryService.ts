import { db } from '../db';
import { stickers, categories, subcategories } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export class InventoryService {
  // Get all categories with slugs for homepage navigation
  async getAllCategories() {
    return await db.select({
      id: categories.id,
      name: categories.name, 
      slug: categories.slug,
      description: categories.description
    }).from(categories).orderBy(categories.name);
  }
  // Get exact count of stickers currently displayed in boxes
  async getStickerInventoryCount() {
    const floralSubcats = await db
      .select({
        id: subcategories.id,
        categoryName: categories.name,
        subcategoryName: subcategories.name,
        boxPosition: subcategories.boxPosition,
      })
      .from(subcategories)
      .innerJoin(categories, eq(subcategories.categoryId, categories.id))
      .where(eq(categories.name, 'Floral'))
      .orderBy(subcategories.boxPosition);

    // Count stickers for each subcategory
    const countsWithStickers = await Promise.all(
      floralSubcats.map(async (subcat) => {
        const [countResult] = await db
          .select({ count: sql`COUNT(*)`.as('count') })
          .from(stickers)
          .where(and(
            eq(stickers.subcategoryId, subcat.id),
            eq(stickers.isActive, true)
          ));
        
        return {
          categoryName: subcat.categoryName,
          subcategoryName: subcat.subcategoryName,
          boxPosition: subcat.boxPosition,
          count: parseInt(countResult.count)
        };
      })
    );

    return countsWithStickers;
  }

  // Get all active stickers by category and box
  async getActiveStickers() {
    const result = await db
      .select()
      .from(stickers)
      .innerJoin(categories, eq(stickers.categoryId, categories.id))
      .innerJoin(subcategories, eq(stickers.subcategoryId, subcategories.id))
      .where(eq(stickers.isActive, true))
      .orderBy(stickers.boxPosition, stickers.displayOrder);

    return result;
  }

  // Add sticker to inventory (called when sticker is added to a box)
  async addStickerToInventory(stickerData: {
    name: string;
    description: string;
    imageUrl: string;
    imageFileName: string;
    categoryId: string;
    subcategoryId: string;
    boxPosition: number;
    displayOrder: number;
    price: string;
    stickerType: 'static_pvc' | 'laminated_vinyl';
  }) {
    const [newSticker] = await db
      .insert(stickers)
      .values(stickerData)
      .returning();

    return newSticker;
  }

  // Remove sticker from inventory (mark as inactive)
  async removeStickerFromInventory(stickerId: string) {
    const [updatedSticker] = await db
      .update(stickers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(stickers.id, stickerId))
      .returning();

    return updatedSticker;
  }

  // Initialize categories and subcategories for Floral page
  async initializeFloralCategories() {
    // Check if Floral category exists
    let [floralCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, 'Floral'));

    if (!floralCategory) {
      [floralCategory] = await db
        .insert(categories)
        .values({
          name: 'Floral',
          description: 'Christian floral stickers with biblical messages'
        })
        .returning();
    }

    // Initialize subcategories with exact box correlation
    const subcategoryData = [
      { name: 'Words in Flowers', boxPosition: 1, description: 'Text integrated within floral designs' },
      { name: 'Flowers and Words', boxPosition: 2, description: 'Flowers positioned alongside text elements' },
      { name: 'Flowers Around Words', boxPosition: 3, description: 'Biblical messages with floral borders/wreaths' }
    ];

    for (const subcat of subcategoryData) {
      const existing = await db
        .select()
        .from(subcategories)
        .where(and(
          eq(subcategories.categoryId, floralCategory.id),
          eq(subcategories.name, subcat.name)
        ));

      if (existing.length === 0) {
        await db
          .insert(subcategories)
          .values({
            categoryId: floralCategory.id,
            ...subcat
          });
      }
    }

    return floralCategory;
  }

  // Get stickers by category and subcategory name
  async getStickersByCategoryAndSubcategory(categoryName: string, subcategoryName: string) {
    const result = await db
      .select({
        sticker: stickers,
        category: categories,
        subcategory: subcategories
      })
      .from(stickers)
      .innerJoin(categories, eq(stickers.categoryId, categories.id))
      .innerJoin(subcategories, eq(stickers.subcategoryId, subcategories.id))
      .where(and(
        eq(categories.name, categoryName),
        eq(subcategories.name, subcategoryName),
        eq(stickers.isActive, true)
      ))
      .orderBy(stickers.boxPosition, stickers.displayOrder);

    return result.map(row => ({
      ...row.sticker,
      category: row.category,
      subcategory: row.subcategory
    }));
  }
}

export const inventoryService = new InventoryService();