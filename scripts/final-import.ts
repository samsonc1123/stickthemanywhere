import fs from 'fs';
import path from 'path';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importStickers() {
  console.log('🚀 Starting sticker import...');
  
  // Get category IDs
  const categoriesResult = await pool.query('SELECT id, name FROM categories');
  const categoryMap: Record<string, number> = {};
  categoriesResult.rows.forEach(cat => {
    categoryMap[cat.name] = cat.id;
  });
  
  console.log('Available categories:', Object.keys(categoryMap));
  
  // Scan sticker files
  const files = fs.readdirSync('./attached_assets')
    .filter(file => /\.(png|jpg|jpeg)$/i.test(file));
  
  console.log(`Found ${files.length} sticker files`);
  
  let imported = 0;
  
  for (const file of files) {
    try {
      // Clean up filename for display name
      const name = file
        .replace(/\.(png|jpg|jpeg)$/i, '')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/IMG\s+/i, 'Sticker ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      
      // Smart categorization
      let categoryId = categoryMap['Animals']; // default
      if (file.toLowerCase().includes('christian') || file.toLowerCase().includes('cross')) {
        categoryId = categoryMap['Christian'];
      } else if (file.toLowerCase().includes('flower') || file.toLowerCase().includes('floral')) {
        categoryId = categoryMap['Floral'];
      } else if (file.toLowerCase().includes('game') || file.toLowerCase().includes('gaming')) {
        categoryId = categoryMap['Gaming'];
      }
      
      // Standard pricing for all 2"x3" Static Clean PVC stickers
      const price = 4.00;
      
      // Check if already exists
      const existing = await pool.query('SELECT id FROM stickers WHERE slug = $1', [slug]);
      if (existing.rows.length > 0) {
        console.log(`⏭️ Skipped: ${name}`);
        continue;
      }
      
      // Insert sticker
      await pool.query(`
        INSERT INTO stickers (name, slug, description, price, image, category_id, is_featured, is_new_arrival, rating, review_count, dimensions)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        name,
        slug,
        `Beautiful ${name.toLowerCase()} sticker perfect for decorating`,
        price,
        file,
        categoryId,
        false,
        true,
        4.5,
        0,
        '3x3'
      ]);
      
      console.log(`✅ Imported: ${name} ($${price})`);
      imported++;
      
    } catch (error) {
      console.error(`❌ Error importing ${file}:`, error.message);
    }
  }
  
  console.log(`🎉 Import complete! ${imported} stickers imported`);
  await pool.end();
}

importStickers().catch(console.error);