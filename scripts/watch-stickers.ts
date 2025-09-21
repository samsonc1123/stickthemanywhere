import chokidar from 'chokidar';
import { importStickers } from './import-stickers';
import path from 'path';

// Auto-import new stickers when files are added
export function watchStickerFolder(assetsDir: string = './attached_assets') {
  console.log('👀 Watching for new sticker files...');
  
  const watcher = chokidar.watch(assetsDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true // don't trigger on existing files
  });

  // Debounce multiple file additions
  let importTimeout: NodeJS.Timeout;
  
  const scheduleImport = () => {
    clearTimeout(importTimeout);
    importTimeout = setTimeout(async () => {
      console.log('🔄 New files detected, running import...');
      try {
        await importStickers(assetsDir);
        console.log('✅ Auto-import completed successfully!');
      } catch (error) {
        console.error('❌ Auto-import failed:', error);
      }
    }, 2000); // Wait 2 seconds for multiple files
  };

  watcher
    .on('add', (filePath) => {
      if (/\.(png|jpg|jpeg|webp)$/i.test(filePath)) {
        const relativePath = path.relative(assetsDir, filePath);
        console.log(`📁 New sticker detected: ${relativePath}`);
        scheduleImport();
      }
    })
    .on('error', error => console.error('❌ Watcher error:', error));

  return watcher;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  watchStickerFolder();
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping sticker watcher...');
    process.exit(0);
  });
}