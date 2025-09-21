import type { CategoryData } from '../types/sticker';
import { categoryColors } from '../constants/colors';

// Mario subcategory stickers
export const marioStickers = [
  // Princess Peach subcategory (index 2)
  {
    src: '/src/assets/IMG_2398_1755361935669.png', // Princess Daisy
    alt: 'Princess Daisy sticker',
    name: 'Princess Daisy'
  },
  {
    src: '/src/assets/IMG_2436_1755363915873.png', // Princess Peach
    alt: 'Princess Peach sticker', 
    name: 'Princess Peach'
  }
];

// Mario category definition
export const marioCategory: CategoryData = {
  name: 'mario',
  title: 'Mario',
  subcategories: [
    { name: 'Mario', color: categoryColors.neonAqua },
    { name: 'Luigi', color: categoryColors.neonAqua },
    { name: 'Princess Peach', color: categoryColors.neonAqua },
    { name: 'Yoshi', color: categoryColors.neonAqua },
    { name: 'Toadstool', color: categoryColors.neonAqua },
    { name: 'Wario', color: categoryColors.neonAqua },
    { name: 'King Koopa', color: categoryColors.neonAqua }
  ],
  stickerCollections: [
    [], // Mario stickers
    [], // Luigi stickers
    marioStickers, // Princess Peach stickers
    [], // Yoshi stickers
    [], // Toadstool stickers
    [], // Wario stickers
    []  // King Koopa stickers
  ]
};