import fs from 'fs';
import path from 'path';
import { db } from '../server/db';
import { categories, subcategories, stickers } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface StickerImport {
  name: string;
  description: string;
  imageUrl: string;
  categoryName: string;
  subcategoryName: string;
  basePrice: string;
}

// Smart name cleanup
function cleanName(filename: string): string {
  return filename
    .replace(/\.(png|jpg|jpeg|webp)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

// Generate description from filename
function generateDescription(filename: string, categoryName: string): string {
  const name = cleanName(filename);
  const descriptors = {
    'Animals': 'Adorable animal sticker perfect for decorating',
    'Christian': 'Inspirational Christian-themed sticker',
    'Gaming': 'Cool gaming sticker for gamers',
    'Floral': 'Beautiful floral design sticker',
    'Anime': 'Vibrant anime-style sticker',
    'Memes': 'Funny meme sticker',
    'Sports': 'Dynamic sports-themed sticker',
    'Movies': 'Epic movie-inspired sticker',
    'TV Shows': 'Popular TV show sticker'
  };
  
  return `${descriptors[categoryName] || 'High-quality sticker'} featuring ${name.toLowerCase()}`;
}

// Determine price based on complexity/category
function determinePrice(filename: string, categoryName: string): string {
  const basePrices = {
    'Animals': '2.99',
    'Christian': '3.49',
    'Gaming': '3.99',
    'Floral': '2.99',
    'Anime': '3.99',
    'Memes': '2.49',
    'Sports': '3.49',
    'Movies': '3.99',
    'TV Shows': '3.49'
  };
  
  // Premium pricing for complex names
  const complexKeywords = ['neon', 'glow', 'premium', 'deluxe', 'special'];
  const isComplex = complexKeywords.some(keyword => 
    filename.toLowerCase().includes(keyword)
  );
  
  const basePrice = parseFloat(basePrices[categoryName] || '2.99');
  return (isComplex ? basePrice + 1.00 : basePrice).toFixed(2);
}

// Map common folder names to categories
function mapCategory(folderName: string): string {
  const categoryMap: Record<string, string> = {
    'animals': 'Animals',
    'anime': 'Anime', 
    'christian': 'Christian',
    'floral': 'Floral',
    'flowers': 'Floral',
    'memes': 'Memes',
    'gaming': 'Gaming',
    'games': 'Gaming',
    'sports': 'Sports',
    'cartoons': '90s Cartoons',
    '90s': '90s Cartoons',
    'tv': 'TV Shows',
    'shows': 'TV Shows',
    'movies': 'Movies',
    'films': 'Movies'
  };
  
  return categoryMap[folderName.toLowerCase()] || 'Miscellaneous';
}

// Scan directory for stickers
function scanStickers(assetsDir: string): StickerImport[] {
  const stickers: StickerImport[] = [];
  
  if (!fs.existsSync(assetsDir)) {
    console.log(`Assets directory ${assetsDir} not found`);
    return stickers;
  }
  
  // Scan organized folders first
  const items = fs.readdirSync(assetsDir, { withFileTypes: true });
  
  for (const item of items) {
    const itemPath = path.join(assetsDir, item.name);
    
    if (item.isDirectory()) {
      // This is a category folder
      const categoryName = mapCategory(item.name);
      const subItems = fs.readdirSync(itemPath, { withFileTypes: true });
      
      for (const subItem of subItems) {
        const subItemPath = path.join(itemPath, subItem.name);
        
        if (subItem.isDirectory()) {
          // This is a subcategory folder
          const subcategoryName = cleanName(subItem.name);
          const files = fs.readdirSync(subItemPath);
          
          for (const file of files) {
            if (/\.(png|jpg|jpeg|webp)$/i.test(file)) {
              stickers.push({
                name: cleanName(file),
                description: generateDescription(file, categoryName),
                imageUrl: `@assets/${item.name}/${subItem.name}/${file}`,
                categoryName,
                subcategoryName,
                basePrice: determinePrice(file, categoryName)
              });
            }
          }
        } else if (/\.(png|jpg|jpeg|webp)$/i.test(subItem.name)) {
          // Direct file in category folder
          stickers.push({
            name: cleanName(subItem.name),
            description: generateDescription(subItem.name, categoryName),
            imageUrl: `@assets/${item.name}/${subItem.name}`,
            categoryName,
            subcategoryName: 'General',
            basePrice: determinePrice(subItem.name, categoryName)
          });
        }
      }
    } else if (/\.(png|jpg|jpeg|webp)$/i.test(item.name)) {
      // Root level sticker - try to categorize by filename
      const filename = item.name.toLowerCase();
      let categoryName = 'Miscellaneous';
      
      if (filename.includes('cat') || filename.includes('dog') || filename.includes('animal')) {
        categoryName = 'Animals';
      } else if (filename.includes('christian') || filename.includes('cross') || filename.includes('jesus')) {
        categoryName = 'Christian';
      } else if (filename.includes('game') || filename.includes('gaming')) {
        categoryName = 'Gaming';
      } else if (filename.includes('flower') || filename.includes('floral')) {
        categoryName = 'Floral';
      }
      
      stickers.push({
        name: cleanName(item.name),
        description: generateDescription(item.name, categoryName),
        imageUrl: `@assets/${item.name}`,
        categoryName,
        subcategoryName: 'General',
        basePrice: determinePrice(item.name, categoryName)
      });
    }
  }
  
  return stickers;
}

// Create category if it doesn't exist
async function ensureCategory(name: string, slug: string): Promise<string> {
  const [existing] = await db.select().from(categories).where(eq(categories.slug, slug));
  
  if (existing) return existing.id;
  
  const [newCategory] = await db.insert(categories).values({
    name,
    slug,
    description: `${name} themed stickers`,
    isActive: true,
    sortOrder: 0
  }).returning();
  
  return newCategory.id;
}

// Create subcategory if it doesn't exist
async function ensureSubcategory(name: string, slug: string, categoryId: string): Promise<string> {
  const [existing] = await db.select().from(subcategories)
    .where(eq(subcategories.slug, slug));
  
  if (existing) return existing.id;
  
  const [newSubcategory] = await db.insert(subcategories).values({
    name,
    slug,
    categoryId,
    description: `${name} subcategory`,
    isActive: true,
    sortOrder: 0
  }).returning();
  
  return newSubcategory.id;
}

// Main import function
export async function importStickers(assetsDir: string = './attached_assets') {
  console.log('🔍 Scanning for sticker images...');
  
  const stickerImports = scanStickers(assetsDir);
  console.log(`📦 Found ${stickerImports.length} sticker images`);
  
  if (stickerImports.length === 0) {
    console.log('No sticker images found. Make sure images are in attached_assets folder.');
    return;
  }
  
  console.log('💾 Importing to database...');
  
  for (const stickerImport of stickerImports) {
    try {
      // Ensure category exists
      const categorySlug = stickerImport.categoryName.toLowerCase().replace(/\s+/g, '-');
      const categoryId = await ensureCategory(stickerImport.categoryName, categorySlug);
      
      // Ensure subcategory exists
      const subcategorySlug = stickerImport.subcategoryName.toLowerCase().replace(/\s+/g, '-');
      const subcategoryId = await ensureSubcategory(stickerImport.subcategoryName, subcategorySlug, categoryId);
      
      // Check if sticker already exists
      const [existing] = await db.select().from(stickers)
        .where(eq(stickers.imageUrl, stickerImport.imageUrl));
      
      if (!existing) {
        // Insert new sticker
        await db.insert(stickers).values({
          name: stickerImport.name,
          description: stickerImport.description,
          imageUrl: stickerImport.imageUrl,
          categoryId,
          subcategoryId,
          basePrice: stickerImport.basePrice,
          isActive: true,
          sortOrder: 0
        });
        
        console.log(`✅ Imported: ${stickerImport.name} (${stickerImport.categoryName}/${stickerImport.subcategoryName})`);
      } else {
        console.log(`⏭️  Skipped: ${stickerImport.name} (already exists)`);
      }
    } catch (error) {
      console.error(`❌ Error importing ${stickerImport.name}:`, error);
    }
  }
  
  console.log('🎉 Import complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importStickers().catch(console.error);
}