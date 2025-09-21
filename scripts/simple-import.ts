import fs from 'fs';
import path from 'path';
import { db } from '../server/db';

// Simple data insertion for existing schema
async function simpleImport() {
  console.log('🚀 Starting simple import...');
  
  // Check existing tables structure
  const result = await db.execute(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_name IN ('categories', 'subcategories', 'stickers')
    ORDER BY table_name, ordinal_position
  `);
  
  console.log('Database structure:', result.rows);
  
  // Create basic categories
  const categories = ['Animals', 'Christian', 'Gaming', 'Floral'];
  
  for (const cat of categories) {
    try {
      await db.execute(`
        INSERT INTO categories (name, slug, color) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (slug) DO NOTHING
      `, [cat, cat.toLowerCase(), 'neon-cyan']);
      
      console.log(`✅ Created category: ${cat}`);
    } catch (error) {
      console.log(`⏭️  Category ${cat} already exists or error:`, error.message);
    }
  }
  
  console.log('🎉 Basic setup complete!');
}

simpleImport().catch(console.error);