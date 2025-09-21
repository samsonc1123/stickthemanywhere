import { db } from "./db";
import {
  categories,
  subcategories,
  stickers,
  cart,
  type Category,
  type Subcategory,
  type Sticker,
  type CartItem,
  type InsertCartItem
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  async getAllCategories(): Promise<(Category & { subcategories: Subcategory[] })[]> {
    const allCategories = await db.select().from(categories);
    const allSubcategories = await db.select().from(subcategories);
    
    return allCategories.map(category => {
      return {
        ...category,
        subcategories: allSubcategories.filter(sub => sub.categoryId === category.id)
      };
    });
  }

  async getCategoryBySlug(slug: string): Promise<(Category & { subcategories: Subcategory[] }) | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    if (!category) return undefined;
    
    const categorySubcategories = await db.select().from(subcategories).where(eq(subcategories.categoryId, category.id));
    
    return {
      ...category,
      subcategories: categorySubcategories
    };
  }

  async getAllStickers(): Promise<Sticker[]> {
    return db.select().from(stickers);
  }

  async getStickerById(id: string): Promise<Sticker | undefined> {
    const [sticker] = await db.select().from(stickers).where(eq(stickers.id, id));
    return sticker;
  }

  async getStickersByCategory(categorySlug: string): Promise<Sticker[]> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, categorySlug));
    if (!category) return [];
    
    return db.select().from(stickers).where(eq(stickers.categoryId, category.id));
  }

  async getStickersByCategoryAndSubcategory(categorySlug: string, subcategorySlug: string): Promise<Sticker[]> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, categorySlug));
    if (!category) return [];
    
    const [subcategory] = await db.select().from(subcategories).where(
      and(eq(subcategories.slug, subcategorySlug), eq(subcategories.categoryId, category.id))
    );
    if (!subcategory) return [];
    
    return db.select().from(stickers).where(
      and(eq(stickers.categoryId, category.id), eq(stickers.subcategoryId, subcategory.id))
    );
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const [cartItem] = await db.insert(cart).values(item).returning();
    return cartItem;
  }

  async getCartItems(userId?: string, sessionId?: string): Promise<CartItem[]> {
    if (userId) {
      return db.select().from(cart).where(eq(cart.userId, userId));
    }
    if (sessionId) {
      return db.select().from(cart).where(eq(cart.sessionId, sessionId));
    }
    return [];
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [updated] = await db.update(cart)
      .set({ quantity })
      .where(eq(cart.id, id))
      .returning();
    return updated;
  }

  async removeFromCart(id: string): Promise<boolean> {
    const result = await db.delete(cart).where(eq(cart.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Seed initial data
  async seedData(): Promise<void> {
    // Check if data already exists
    const existingCategories = await db.select().from(categories);
    if (existingCategories.length > 0) return;

    // Insert categories
    const categoryData = [
      { name: "Animals", slug: "animals", description: "Animal-themed stickers" },
      { name: "Christian", slug: "christian", description: "Christian-themed stickers" },
      { name: "Gaming", slug: "gaming", description: "Gaming-themed stickers" }
    ];

    const insertedCategories = await db.insert(categories).values(categoryData).returning();

    // Insert subcategories
    const subcategoryData = [
      { name: "Cats", slug: "cats", categoryId: insertedCategories[0].id },
      { name: "Dogs", slug: "dogs", categoryId: insertedCategories[0].id },
      { name: "Wildlife", slug: "wildlife", categoryId: insertedCategories[0].id },
      { name: "Hearts", slug: "hearts", categoryId: insertedCategories[1].id },
      { name: "Crosses", slug: "crosses", categoryId: insertedCategories[1].id },
      { name: "Flowers", slug: "flowers", categoryId: insertedCategories[1].id },
      { name: "Retro", slug: "retro", categoryId: insertedCategories[2].id },
      { name: "Modern", slug: "modern", categoryId: insertedCategories[2].id }
    ];

    const insertedSubcategories = await db.insert(subcategories).values(subcategoryData).returning();

    // Insert sample stickers
    const stickerData = [
      {
        name: "Cute Cat",
        description: "Adorable cat sticker",
        imageUrl: "/images/cat1.png",
        categoryId: insertedCategories[0].id,
        subcategoryId: insertedSubcategories[0].id,
        basePrice: "2.99"
      },
      {
        name: "Happy Dog",
        description: "Joyful dog sticker",
        imageUrl: "/images/dog1.png",
        categoryId: insertedCategories[0].id,
        subcategoryId: insertedSubcategories[1].id,
        basePrice: "2.99"
      },
      {
        name: "Cross with Heart",
        description: "Christian cross with heart",
        imageUrl: "/images/cross-heart.png",
        categoryId: insertedCategories[1].id,
        subcategoryId: insertedSubcategories[4].id,
        basePrice: "3.49"
      }
    ];

    await db.insert(stickers).values(stickerData);
  }
}