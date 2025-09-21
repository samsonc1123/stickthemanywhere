/**
 * Fix the inventory count by properly querying subcategories
 */
import { db } from '../db';
import { stickers, subcategories, categories } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

async function fixInventoryCount() {
  console.log('🔄 Fixing inventory count...');
  
  try {
    // Get all subcategories for Floral category
    const floralSubcats = await db
      .select({
        id: subcategories.id,
        name: subcategories.name,
        boxPosition: subcategories.boxPosition,
        categoryName: categories.name
      })
      .from(subcategories)
      .innerJoin(categories, eq(subcategories.categoryId, categories.id))
      .where(eq(categories.name, 'Floral'))
      .orderBy(subcategories.boxPosition);

    console.log('\n📊 Inventory Count by Box:');
    
    for (const subcat of floralSubcats) {
      const [result] = await db
        .select({ count: sql`COUNT(*)`.as('count') })
        .from(stickers)
        .where(and(
          eq(stickers.subcategoryId, subcat.id),
          eq(stickers.isActive, true)
        ));
      
      console.log(`   Box ${subcat.boxPosition} (${subcat.name}): ${result.count} stickers`);
    }
    
    // Calculate total
    const [totalResult] = await db
      .select({ count: sql`COUNT(*)`.as('count') })
      .from(stickers)
      .innerJoin(subcategories, eq(stickers.subcategoryId, subcategories.id))
      .innerJoin(categories, eq(subcategories.categoryId, categories.id))
      .where(and(
        eq(categories.name, 'Floral'),
        eq(stickers.isActive, true)
      ));
    
    console.log(`   TOTAL: ${totalResult.count} stickers in inventory\n`);
    
  } catch (error) {
    console.error('❌ Error fixing inventory count:', error);
  }
}

// Run the fix
fixInventoryCount();