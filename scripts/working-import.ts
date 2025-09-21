import fs from 'fs';
import path from 'path';
import { db } from '../server/db';

interface StickerData {
  name: string;
  slug: string;
  description: string;
  price: number;
  image: string;
  categoryName: string;
  subcategoryName: string;
}

// Clean filename to create name
function cleanName(filename: string): string {
  return filename
    .replace(/\.(png|jpg|jpeg|webp)$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

// Create URL-friendly slug
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Smart categorization based on filename
function categorizeSticker(filename: string): { category: string; subcategory: string } {
  const lower = filename.toLowerCase();
  
  if (lower.includes('cat') || lower.includes('kitten') || lower.includes('feline')) {
    return { category: 'Animals', subcategory: 'Cats' };
  }
  if (lower.includes('dog') || lower.includes('puppy') || lower.includes('canine')) {
    return { category: 'Animals', subcategory: 'Dogs' };
  }
  if (lower.includes('christian') || lower.includes('cross') || lower.includes('jesus') || lower.includes('bible')) {
    return { category: 'Christian', subcategory: 'Faith' };
  }
  if (lower.includes('flower') || lower.includes('floral') || lower.includes('blossom')) {
    return { category: 'Floral', subcategory: 'Flowers' };
  }
  if (lower.includes('game') || lower.includes('gaming') || lower.includes('controller')) {
    return { category: 'Gaming', subcategory: 'Controllers' };
  }
  if (lower.includes('anime') || lower.includes('manga')) {
    return { category: 'Anime', subcategory: 'Characters' };
  }
  if (lower.includes('meme') || lower.includes('funny')) {
    return { category: 'Memes', subcategory: 'Funny' };
  }
  if (lower.includes('sport') || lower.includes('ball')) {
    return { category: 'Sports', subcategory: 'Ball Sports' };
  }
  
  // Default fallback
  return { category: 'Miscellaneous', subcategory: 'General' };
}

// Generate description
function generateDescription(name: string, category: string): string {
  const templates = {
    'Animals': `Adorable ${name.toLowerCase()} sticker perfect for animal lovers`,
    'Christian': `Inspirational ${name.toLowerCase()} sticker with faith-based design`,
    'Gaming': `Cool ${name.toLowerCase()} gaming sticker for gamers and streamers`,
    'Floral': `Beautiful ${name.toLowerCase()} sticker with elegant floral design`,
    'Anime': `Vibrant ${name.toLowerCase()} anime-style sticker`,
    'Memes': `Hilarious ${name.toLowerCase()} meme sticker guaranteed to make you laugh`,
    'Sports': `Dynamic ${name.toLowerCase()} sports sticker for athletes and fans`,
    'Miscellaneous': `High-quality ${name.toLowerCase()} sticker`
  };
  
  return templates[category] || templates['Miscellaneous'];
}

// Standard pricing for all PVC stickers
function determinePricing(filename: string, category: string): number {
  // All standard 2"x3" Static Clean PVC stickers are $4.00
  // Quantity discounts: 1 for $4, 3 for $10, 8 for $20
  // Laminated vinyl stickers: 1 for $5, 3 for $10, 8 for $20
  return 4.00;
}

// Scan for sticker files
function scanStickerFiles(assetsDir: string): StickerData[] {
  const stickers: StickerData[] = [];
  
  if (!fs.existsSync(assetsDir)) {
    console.log(`Assets directory not found: ${assetsDir}`);
    return stickers;
  }
  
  const files = fs.readdirSync(assetsDir);
  
  for (const file of files) {
    const filePath = path.join(assetsDir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(file)) {
      const name = cleanName(file);
      const { category, subcategory } = categorizeSticker(file);
      
      stickers.push({
        name,
        slug: createSlug(name),
        description: generateDescription(name, category),
        price: determinePricing(file, category),
        image: file, // Store relative filename
        categoryName: category,
        subcategoryName: subcategory
      });
    }
  }
  
  return stickers;
}

// Get or create category
async function ensureCategory(name: string): Promise<number> {
  const slug = createSlug(name);
  
  // Check if exists
  const existing = await db.execute(`SELECT id FROM categories WHERE slug = $1`, [slug]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id as number;
  }
  
  // Create new category
  const result = await db.execute(`
    INSERT INTO categories (name, slug, color, description) 
    VALUES ($1, $2, $3, $4) 
    RETURNING id
  `, [name, slug, 'neon-cyan', `${name} themed stickers`]);
  
  return result.rows[0].id as number;
}

// Get or create subcategory
async function ensureSubcategory(name: string, categoryId: number): Promise<number> {
  const slug = createSlug(name);
  
  // Check if exists
  const existing = await db.execute(`
    SELECT id FROM subcategories WHERE slug = $1 AND category_id = $2
  `, [slug, categoryId]);
  
  if (existing.rows.length > 0) {
    return existing.rows[0].id as number;
  }
  
  // Create new subcategory
  const result = await db.execute(`
    INSERT INTO subcategories (name, slug, category_id, description) 
    VALUES ($1, $2, $3, $4) 
    RETURNING id
  `, [name, slug, categoryId, `${name} subcategory`]);
  
  return result.rows[0].id as number;
}

// Main import function
export async function importAllStickers() {
  console.log('🔍 Scanning for sticker images...');
  
  const stickers = scanStickerFiles('./attached_assets');
  console.log(`📦 Found ${stickers.length} sticker images`);
  
  if (stickers.length === 0) {
    console.log('No sticker images found in attached_assets folder');
    return;
  }
  
  console.log('💾 Importing to database...');
  
  let imported = 0;
  let skipped = 0;
  
  for (const sticker of stickers) {
    try {
      // Get category and subcategory IDs
      const categoryId = await ensureCategory(sticker.categoryName);
      const subcategoryId = await ensureSubcategory(sticker.subcategoryName, categoryId);
      
      // Check if sticker already exists
      const existing = await db.execute(`
        SELECT id FROM stickers WHERE slug = $1
      `, [sticker.slug]);
      
      if (existing.rows.length > 0) {
        console.log(`⏭️  Skipped: ${sticker.name} (already exists)`);
        skipped++;
        continue;
      }
      
      // Insert sticker
      await db.execute(`
        INSERT INTO stickers (
          name, slug, description, price, image, 
          category_id, subcategory_id, is_featured, is_new_arrival,
          rating, review_count, dimensions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        sticker.name,
        sticker.slug,
        sticker.description,
        sticker.price,
        sticker.image,
        categoryId,
        subcategoryId,
        false, // is_featured
        true,  // is_new_arrival
        4.5,   // default rating
        0,     // review_count
        '3x3'  // default dimensions
      ]);
      
      console.log(`✅ Imported: ${sticker.name} ($${sticker.price}) - ${sticker.categoryName}/${sticker.subcategoryName}`);
      imported++;
      
    } catch (error) {
      console.error(`❌ Error importing ${sticker.name}:`, error.message);
    }
  }
  
  console.log(`🎉 Import complete! ${imported} imported, ${skipped} skipped`);
}

// Auto-watch functionality
export function startWatching() {
  console.log('👀 Starting file watcher...');
  
  const chokidar = require('chokidar');
  const watcher = chokidar.watch('./attached_assets', {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
  });
  
  let timeout: NodeJS.Timeout;
  
  const scheduleImport = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      console.log('🔄 New files detected, running import...');
      importAllStickers().catch(console.error);
    }, 2000);
  };
  
  watcher.on('add', (filePath: string) => {
    if (/\.(png|jpg|jpeg|webp)$/i.test(filePath)) {
      console.log(`📁 New sticker detected: ${path.basename(filePath)}`);
      scheduleImport();
    }
  });
  
  return watcher;
}

// Run import if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importAllStickers().catch(console.error);
}