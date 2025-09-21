#!/usr/bin/env tsx
import { importStickers } from './import-stickers.js';

// Run the import
console.log('🚀 Starting sticker import process...');
importStickers('./attached_assets')
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });