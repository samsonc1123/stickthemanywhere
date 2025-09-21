// scripts/bulk-upload.ts
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import slugify from "slugify";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

// localFolder structure: assets/hispanic/flags/puerto-rico.png
const localRoot = "assets";

async function main() {
  for (const category of fs.readdirSync(localRoot)) {
    const catSlug = slugify(category, { lower: true, strict: true });

    // upsert category
    const { data: cat } = await supabase.from("categories")
      .upsert({ 
        slug: catSlug, 
        name: category,
        description: `${category} stickers collection`
      }, { onConflict: "slug" })
      .select("*").single();

    console.log(`Processing category: ${category}`);

    for (const sub of fs.readdirSync(path.join(localRoot, category))) {
      // upsert subcategory
      const { data: subcat } = await supabase.from("subcategories")
        .upsert({ 
          name: sub, 
          category_id: cat!.id,
          description: `${sub} subcategory for ${category}`,
          box_position: 1 // Default to box 1, you can adjust per your needs
        }, { onConflict: "category_id,name" })
        .select("*").single();

      console.log(`  Processing subcategory: ${sub}`);

      const dir = path.join(localRoot, category, sub);
      let displayOrder = 1;

      for (const file of fs.readdirSync(dir)) {
        const name = path.parse(file).name;
        const stickerSlug = slugify(name, { lower: true, strict: true });
        const remotePath = `stickers/${catSlug}/${stickerSlug}${path.extname(file)}`;

        // upload file to Supabase Storage
        const fileBuffer = fs.readFileSync(path.join(dir, file));
        const { error: uploadError } = await supabase.storage
          .from("stickers")
          .upload(remotePath, fileBuffer, { upsert: true });

        if (uploadError) {
          console.error(`Upload error for ${file}:`, uploadError);
          continue;
        }

        // Get public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
          .from("stickers")
          .getPublicUrl(remotePath);

        // insert sticker row with correct schema fields
        const { error: insertError } = await supabase.from("stickers").upsert({
          category_id: cat!.id,
          subcategory_id: subcat!.id,
          name: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Convert to title case
          description: `Beautiful ${name.replace(/-/g, ' ')} sticker`,
          image_url: publicUrl,
          image_file_name: file,
          price: "4.00", // Default price - adjust as needed
          sticker_type: "Static PVC", // Default type - adjust as needed
          size: "2x3", // Default size
          is_active: true,
          box_position: 1, // Default to box 1
          display_order: displayOrder++
        }, { onConflict: "subcategory_id,name" });

        if (insertError) {
          console.error(`Insert error for ${name}:`, insertError);
        } else {
          console.log(`    Added sticker: ${name}`);
        }
      }
    }
  }
  console.log("Done ✔");
}

main().catch((e) => { 
  console.error("Script failed:", e); 
  process.exit(1); 
});