// scripts/upload-stickers.ts
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

async function uploadStickers() {
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
  
  for (const file of files) {
    const filePath = path.join(attachedAssetsDir, file);
    const remotePath = `stickers/${file}`;
    
    // Upload file to Supabase Storage
    const fileBuffer = fs.readFileSync(filePath);
    const { error: uploadError } = await supabase.storage
      .from("stickers")
      .upload(remotePath, fileBuffer, { upsert: true });
    
    if (uploadError) {
      console.error(`Upload error for ${file}:`, uploadError);
      continue;
    }
    
    // Get permanent public URL
    const { data: { publicUrl } } = supabase.storage
      .from("stickers")
      .getPublicUrl(remotePath);
    
    publicUrls.push({ filename: file, url: publicUrl });
    console.log(`✅ Uploaded: ${file}`);
    console.log(`   URL: ${publicUrl}`);
  }
  
  console.log("\n=== UPLOAD COMPLETE ===");
  console.log(`Successfully uploaded ${publicUrls.length} stickers`);
  console.log("\n=== PERMANENT PUBLIC URLS ===");
  
  publicUrls.forEach(({ filename, url }) => {
    console.log(`${filename}: ${url}`);
  });
  
  return publicUrls;
}

uploadStickers().catch((error) => {
  console.error("Upload failed:", error);
  process.exit(1);
});