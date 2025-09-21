// scripts/create-bucket-and-upload.ts
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

async function createBucketAndUpload() {
  // First, create the stickers bucket
  console.log("Creating 'stickers' storage bucket...");
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket('stickers', {
    public: true,
    fileSizeLimit: 1024 * 1024 * 10 // 10MB limit
  });
  
  if (bucketError && !bucketError.message.includes('already exists')) {
    console.error("Failed to create bucket:", bucketError);
    return;
  }
  
  console.log("✅ Storage bucket ready");
  
  const attachedAssetsDir = "attached_assets";
  const publicUrls: { filename: string; url: string }[] = [];
  
  if (!fs.existsSync(attachedAssetsDir)) {
    console.error("No attached_assets directory found");
    return;
  }
  
  const files = fs.readdirSync(attachedAssetsDir).filter(file => 
    file.toLowerCase().endsWith('.png') || 
    file.toLowerCase().endsWith('.jpg') || 
    file.toLowerCase().endsWith('.jpeg')
  );
  
  console.log(`Found ${files.length} image files to upload`);
  
  // Upload in smaller batches to avoid timeouts
  const batchSize = 20;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(`\nUploading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(files.length/batchSize)} (${batch.length} files)...`);
    
    for (const file of batch) {
      const filePath = path.join(attachedAssetsDir, file);
      const remotePath = `stickers/${file}`;
      
      try {
        // Upload file to Supabase Storage
        const fileBuffer = fs.readFileSync(filePath);
        const { error: uploadError } = await supabase.storage
          .from("stickers")
          .upload(remotePath, fileBuffer, { upsert: true });
        
        if (uploadError) {
          console.error(`❌ Upload error for ${file}:`, uploadError.message);
          continue;
        }
        
        // Get permanent public URL
        const { data: { publicUrl } } = supabase.storage
          .from("stickers")
          .getPublicUrl(remotePath);
        
        publicUrls.push({ filename: file, url: publicUrl });
        console.log(`✅ ${file}`);
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error);
      }
    }
  }
  
  console.log("\n=== UPLOAD COMPLETE ===");
  console.log(`Successfully uploaded ${publicUrls.length} out of ${files.length} stickers`);
  console.log("\n=== PERMANENT PUBLIC URLS ===");
  
  publicUrls.forEach(({ filename, url }) => {
    console.log(`${filename}: ${url}`);
  });
  
  return publicUrls;
}

createBucketAndUpload().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});