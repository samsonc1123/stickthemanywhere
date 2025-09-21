// scripts/fixed-upload.ts
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

async function uploadStickersToSupabase() {
  // Step 1: Create the stickers bucket with public access
  console.log("🪣 Creating 'stickers' storage bucket...");
  const { error: bucketError } = await supabase.storage.createBucket('stickers', {
    public: true,
    fileSizeLimit: 1024 * 1024 * 10 // 10MB limit
  });
  
  if (bucketError && !bucketError.message.includes('already exists')) {
    console.error("❌ Failed to create bucket:", bucketError.message);
    return [];
  }
  
  console.log("✅ Storage bucket ready");
  
  // Step 2: Find all image files
  const attachedAssetsDir = "attached_assets";
  if (!fs.existsSync(attachedAssetsDir)) {
    console.error("❌ No attached_assets directory found");
    return [];
  }
  
  const files = fs.readdirSync(attachedAssetsDir).filter(file => 
    /\.(png|jpg|jpeg)$/i.test(file)
  );
  
  console.log(`📁 Found ${files.length} image files to upload`);
  
  // Step 3: Upload in small batches
  const publicUrls: { filename: string; url: string }[] = [];
  const batchSize = 10; // Smaller batches to prevent timeouts
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchNum = Math.floor(i/batchSize) + 1;
    const totalBatches = Math.ceil(files.length/batchSize);
    
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} files):`);
    
    // Process batch in parallel (but limit concurrency)
    const uploadPromises = batch.map(async (file) => {
      try {
        const filePath = path.join(attachedAssetsDir, file);
        // Fixed: use just the filename, not 'stickers/filename'
        const remotePath = file;
        
        const fileBuffer = fs.readFileSync(filePath);
        const { error: uploadError } = await supabase.storage
          .from("stickers")
          .upload(remotePath, fileBuffer, { upsert: true });
        
        if (uploadError) {
          console.error(`   ❌ ${file}: ${uploadError.message}`);
          return null;
        }
        
        // Get permanent public URL
        const { data: { publicUrl } } = supabase.storage
          .from("stickers")
          .getPublicUrl(remotePath);
        
        console.log(`   ✅ ${file}`);
        return { filename: file, url: publicUrl };
        
      } catch (error) {
        console.error(`   ❌ ${file}: ${error}`);
        return null;
      }
    });
    
    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter(result => result !== null);
    publicUrls.push(...successfulUploads);
    
    // Small delay between batches
    if (i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log("\n🎉 UPLOAD COMPLETE!");
  console.log(`✅ Successfully uploaded: ${publicUrls.length}/${files.length} stickers`);
  
  if (publicUrls.length > 0) {
    console.log("\n🔗 PERMANENT PUBLIC URLS:");
    console.log("=" * 50);
    publicUrls.forEach(({ filename, url }) => {
      console.log(`${filename}`);
      console.log(`${url}\n`);
    });
  }
  
  return publicUrls;
}

uploadStickersToSupabase().catch((error) => {
  console.error("💥 Upload script failed:", error);
  process.exit(1);
});