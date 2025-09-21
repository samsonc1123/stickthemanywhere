/**
 * Script to sync the current Floral page stickers to the database inventory
 * This creates database records for exactly what's displayed in the boxes
 */
import { db } from '../db';
import { categories, subcategories, stickers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Exact inventory from the current Floral page
const floralInventory = {
  // Box 1: "Words in Flowers" (16 stickers)
  wordsInFlowers: [
    { name: "Pray", imageFileName: "IMG_2530_1755373512743.png", order: 1 },
    { name: "Trust", imageFileName: "IMG_2521_1755367431540.png", order: 2 },
    { name: "Faith", imageFileName: "IMG_2531_1755373929426.png", order: 3 },
    { name: "The LORD is good", imageFileName: "IMG_2532_1755373929426.png", order: 4 },
    { name: "Create in me a pure heart", imageFileName: "IMG_2533_1755373929426.png", order: 5 },
    { name: "A friend loves at all times", imageFileName: "IMG_2534_1755373929426.png", order: 6 },
    { name: "Every word of God is flawless", imageFileName: "IMG_2535_1755373929426.png", order: 7 },
    { name: "Let your light shine before others", imageFileName: "IMG_2536_1755373929426.png", order: 8 },
    { name: "The fear of the LORD is the beginning of knowledge", imageFileName: "IMG_2537_1755373929426.png", order: 9 },
    { name: "Faith text on teal flower", imageFileName: "IMG_2787_1755469135866.png", order: 10 },
    { name: "Child of God on sunflower", imageFileName: "IMG_2786_1755469135869.png", order: 11 },
    { name: "Grateful and blessed on poppy", imageFileName: "IMG_2788_1755469135869.png", order: 12 },
    { name: "I am a child of God on pink flowers", imageFileName: "IMG_2785_1755469135869.png", order: 13 },
    { name: "I will sing of the LORD's great love forever", imageFileName: "IMG_2705_1755393025483.png", order: 14 },
    { name: "Jesus Christ is the same yesterday and today and forever", imageFileName: "IMG_2706_1755393025483.png", order: 15 },
  ],
  
  // Box 2: "Flowers and Words" (19 stickers)
  flowersAndWords: [
    { name: "Beloved with orange flowers", imageFileName: "IMG_2721_1755394403561.png", order: 1 },
    { name: "The greatest of these is love", imageFileName: "IMG_2711_1755394897968.png", order: 2 },
    { name: "Give and it will be given to you Luke 6:38", imageFileName: "IMG_2709_1755394897968.png", order: 3 },
    { name: "Great is your faithfulness", imageFileName: "IMG_2710_1755394897968.png", order: 4 },
    { name: "Take heart", imageFileName: "IMG_2714_1755394897968.png", order: 5 },
    { name: "Plans to prosper you", imageFileName: "IMG_2708_1755394897968.png", order: 6 },
    { name: "Believe with flower", imageFileName: "IMG_2713_1755395210908.png", order: 7 },
    { name: "Take delight in the LORD", imageFileName: "IMG_2716_1755395210909.png", order: 8 },
    { name: "Nothing is too hard for you", imageFileName: "IMG_2715_1755395210909.png", order: 9 },
    { name: "Be strong and courageous", imageFileName: "IMG_2718_1755395210909.png", order: 10 },
    { name: "Ask and it will be given to you", imageFileName: "IMG_2720_1755395210909.png", order: 11 },
    { name: "Your promise preserves my life", imageFileName: "IMG_2722_1755395210909.png", order: 12 },
    { name: "Give us today our daily bread", imageFileName: "IMG_2723_1755395210909.png", order: 13 },
    { name: "Be joyful in hope Romans 12:12", imageFileName: "IMG_2783_1755468161306.png", order: 14 },
    { name: "The LORD is my shepherd I lack nothing Psalm 23:1", imageFileName: "IMG_2779_1755468161308.png", order: 15 },
    { name: "Do it all for the glory of God 1 Corinthians 10:31", imageFileName: "IMG_2782_1755468161308.png", order: 16 },
    { name: "Put your hope in God", imageFileName: "IMG_2780_1755468161308.png", order: 17 },
    { name: "Do everything in love", imageFileName: "IMG_2778_1755468361658.png", order: 18 },
    { name: "BLESSED envelope with flowers", imageFileName: "IMG_2781_1755468361661.png", order: 19 },
  ],
  
  // Box 3: "Flowers Around Words" (19 stickers)
  flowersAroundWords: [
    { name: "In everything give thanks", imageFileName: "IMG_2734_1755464635522.png", order: 1 },
    { name: "Come to me all you who are weary", imageFileName: "IMG_2740_1755464762704.png", order: 2 },
    { name: "Child of God floral wreath", imageFileName: "IMG_2739_1755464762704.png", order: 3 },
    { name: "It is well with my soul", imageFileName: "IMG_2738_1755464762704.png", order: 4 },
    { name: "She laughs without fear", imageFileName: "IMG_2737_1755464762704.png", order: 5 },
    { name: "Walk in love as wise", imageFileName: "IMG_2736_1755464762704.png", order: 6 },
    { name: "Do to others as you would have them do to you Luke 6:31", imageFileName: "IMG_2735_1755464762704.png", order: 7 },
    { name: "Every good and perfect gift is from above James 1:17", imageFileName: "IMG_2752_1755465748072.png", order: 8 },
    { name: "As for me I will always have hope Psalm 71:14", imageFileName: "IMG_2753_1755465748072.png", order: 9 },
    { name: "She is clothed with strength and dignity Proverbs 31:25", imageFileName: "IMG_2756_1755465748072.png", order: 10 },
    { name: "Devote yourselves to prayer being watchful and thankful", imageFileName: "IMG_2755_1755465748072.png", order: 11 },
    { name: "Turn your eyes upon Jesus", imageFileName: "IMG_2754_1755465748072.png", order: 12 },
    { name: "The Lord will guide you always Isaiah 58:11", imageFileName: "IMG_2759_1755465748072.png", order: 13 },
    { name: "Give thanks to the Lord", imageFileName: "IMG_2758_1755465748073.png", order: 14 },
    { name: "I will sing to the Lord all my life Psalm 104:33", imageFileName: "IMG_2757_1755465748073.png", order: 15 },
    { name: "He heals the broken hearted Psalm 147:3", imageFileName: "IMG_2760_1755465748073.png", order: 16 },
    { name: "As iron sharpens iron so one person sharpens another", imageFileName: "IMG_2761_1755465748073.png", order: 17 },
    { name: "Grace upon grace", imageFileName: "IMG_2762_1755465748073.png", order: 18 },
    { name: "When my heart is overwhelmed lead me to the rock that is higher than I Psalm 61:2", imageFileName: "IMG_2784_1755468880202.png", order: 19 },
  ]
};

async function syncFloralInventory() {
  console.log('🔄 Starting Floral inventory sync...');
  
  try {
    // Get or create Floral category
    let [floralCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, 'Floral'));
    
    if (!floralCategory) {
      [floralCategory] = await db
        .insert(categories)
        .values({
          name: 'Floral',
          description: 'Christian floral stickers with biblical messages'
        })
        .returning();
      console.log('✅ Created Floral category');
    }

    // Get or create subcategories with box positions
    const subcategoryData = [
      { name: 'Words in Flowers', boxPosition: 1, description: 'Text integrated within floral designs' },
      { name: 'Flowers and Words', boxPosition: 2, description: 'Flowers positioned alongside text elements' },
      { name: 'Flowers Around Words', boxPosition: 3, description: 'Biblical messages with floral borders/wreaths' }
    ];

    const subcategoryMap = new Map();
    
    for (const subcat of subcategoryData) {
      let [existingSubcat] = await db
        .select()
        .from(subcategories)
        .where(and(
          eq(subcategories.categoryId, floralCategory.id),
          eq(subcategories.name, subcat.name)
        ));
      
      if (!existingSubcat) {
        [existingSubcat] = await db
          .insert(subcategories)
          .values({
            categoryId: floralCategory.id,
            ...subcat
          })
          .returning();
        console.log(`✅ Created subcategory: ${subcat.name}`);
      }
      
      subcategoryMap.set(subcat.name, existingSubcat);
    }

    // Add stickers for each box
    const stickerGroups = [
      { name: 'Words in Flowers', stickers: floralInventory.wordsInFlowers, boxPosition: 1 },
      { name: 'Flowers and Words', stickers: floralInventory.flowersAndWords, boxPosition: 2 },
      { name: 'Flowers Around Words', stickers: floralInventory.flowersAroundWords, boxPosition: 3 }
    ];

    let totalAdded = 0;
    
    for (const group of stickerGroups) {
      const subcategory = subcategoryMap.get(group.name);
      
      for (const stickerData of group.stickers) {
        // Check if sticker already exists
        const existing = await db
          .select()
          .from(stickers)
          .where(and(
            eq(stickers.imageFileName, stickerData.imageFileName),
            eq(stickers.subcategoryId, subcategory.id)
          ));
        
        if (existing.length === 0) {
          await db.insert(stickers).values({
            categoryId: floralCategory.id,
            subcategoryId: subcategory.id,
            name: stickerData.name,
            description: `Christian floral sticker: ${stickerData.name}`,
            imageUrl: `/assets/${stickerData.imageFileName}`,
            imageFileName: stickerData.imageFileName,
            price: '4.00', // Base price for static PVC
            stickerType: 'static_pvc',
            size: '2x3',
            boxPosition: group.boxPosition,
            displayOrder: stickerData.order,
            isActive: true
          });
          
          totalAdded++;
        }
      }
      
      console.log(`✅ Synced ${group.stickers.length} stickers for ${group.name}`);
    }

    console.log(`🎉 Inventory sync complete! Added ${totalAdded} new stickers to database.`);
    
    // Display final count
    const finalCount = await db
      .select({
        subcategory: subcategories.name,
        boxPosition: subcategories.boxPosition,
        count: db.$count(stickers, eq(stickers.isActive, true))
      })
      .from(stickers)
      .innerJoin(subcategories, eq(stickers.subcategoryId, subcategories.id))
      .where(eq(stickers.isActive, true))
      .groupBy(subcategories.name, subcategories.boxPosition)
      .orderBy(subcategories.boxPosition);
    
    console.log('\n📊 Final Inventory Count:');
    finalCount.forEach(item => {
      console.log(`   Box ${item.boxPosition} (${item.subcategory}): ${item.count} stickers`);
    });
    
    const total = finalCount.reduce((sum, item) => sum + item.count, 0);
    console.log(`   TOTAL: ${total} stickers in inventory\n`);
    
  } catch (error) {
    console.error('❌ Error syncing inventory:', error);
  }
}

// Run the sync
syncFloralInventory();