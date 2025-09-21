import { 
  type Category, 
  type Subcategory, 
  type Sticker, 
  type CartItem,
  type InsertCartItem,
  type User,
  type UpsertUser
} from "@shared/schema";

// Interface defines all database operations
export interface IStorage {
  // User operations (required for authentication)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Categories
  getAllCategories(): Promise<(Category & { subcategories: Subcategory[] })[]>;
  getCategoryBySlug(slug: string): Promise<(Category & { subcategories: Subcategory[] }) | undefined>;
  
  // Stickers
  getAllStickers(): Promise<Sticker[]>;
  getStickerById(id: string): Promise<Sticker | undefined>;
  getStickersByCategory(categorySlug: string): Promise<Sticker[]>;
  getStickersByCategoryAndSubcategory(categorySlug: string, subcategorySlug: string): Promise<Sticker[]>;
  
  // Cart operations
  addToCart(item: InsertCartItem): Promise<CartItem>;
  getCartItems(userId?: string, sessionId?: string): Promise<CartItem[]>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: string): Promise<boolean>;
}



import { db } from './db';
import { users, categories, subcategories, stickers, cartItems } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Database implementation of the storage interface
export class DatabaseStorage implements IStorage {
  // User operations (required for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllCategories(): Promise<(Category & { subcategories: Subcategory[] })[]> {
    const categoriesWithSubs = await db.query.categories.findMany({
      with: {
        subcategories: true,
      },
    });
    return categoriesWithSubs;
  }

  async getCategoryBySlug(slug: string): Promise<(Category & { subcategories: Subcategory[] }) | undefined> {
    // For now, match by name since we don't have slug in the new schema
    const category = await db.query.categories.findFirst({
      where: eq(categories.name, slug),
      with: {
        subcategories: true,
      },
    });
    return category;
  }

  async getAllStickers(): Promise<Sticker[]> {
    return await db.select().from(stickers).where(eq(stickers.isActive, true));
  }

  async getStickerById(id: string): Promise<Sticker | undefined> {
    const [sticker] = await db.select().from(stickers).where(eq(stickers.id, id));
    return sticker;
  }

  async getStickersByCategory(categorySlug: string): Promise<Sticker[]> {
    const category = await this.getCategoryBySlug(categorySlug);
    if (!category) return [];
    
    return await db
      .select()
      .from(stickers)
      .where(eq(stickers.categoryId, category.id))
      .orderBy(stickers.boxPosition, stickers.displayOrder);
  }

  async getStickersByCategoryAndSubcategory(categorySlug: string, subcategorySlug: string): Promise<Sticker[]> {
    const category = await this.getCategoryBySlug(categorySlug);
    if (!category) return [];
    
    const subcategory = category.subcategories.find(sub => sub.name.toLowerCase() === subcategorySlug.toLowerCase());
    if (!subcategory) return [];
    
    return await db
      .select()
      .from(stickers)
      .where(eq(stickers.subcategoryId, subcategory.id))
      .orderBy(stickers.displayOrder);
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const [cartItem] = await db.insert(cartItems).values(item).returning();
    return cartItem;
  }

  async getCartItems(userId?: string, sessionId?: string): Promise<CartItem[]> {
    if (userId) {
      return await db.select().from(cartItems).where(eq(cartItems.userId, userId));
    } else if (sessionId) {
      return await db.select().from(cartItems).where(eq(cartItems.sessionId, sessionId));
    }
    return [];
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [updated] = await db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, id))
      .returning();
    return updated;
  }

  async removeFromCart(id: string): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.id, id));
    return result.rowCount > 0;
  }
}

// Use database storage
export const storage = new DatabaseStorage();