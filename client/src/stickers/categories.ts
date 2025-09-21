// Centralized category definitions and sticker data
import type { CategoryData } from '../types/sticker';
import { categoryColors } from '../constants/colors';

// Gaming category definition  
export const gamingCategory: CategoryData = {
  name: 'gaming',
  title: 'Gaming',
  subcategories: [
    { name: 'Mario', color: categoryColors.neonAqua },
    { name: 'Sonic', color: categoryColors.neonAqua },
    { name: 'D & D', color: categoryColors.neonAqua },
    { name: 'Zelda', color: categoryColors.neonAqua },
    { name: 'Mashups', color: categoryColors.neonAqua },
    { name: 'Minecraft', color: categoryColors.neonAqua },
    { name: 'Roblox', color: categoryColors.neonAqua },
    { name: 'Pokemon', color: categoryColors.neonAqua },
    { name: 'Fortnite', color: categoryColors.neonAqua },
    { name: 'Among Us', color: categoryColors.neonAqua },
    { name: 'Fall Guys', color: categoryColors.neonAqua }
  ],
  stickerCollections: [
    [], // Mario stickers
    [], // Sonic stickers
    [], // D & D stickers
    [], // Zelda stickers
    [], // Mashups stickers
    [], // Minecraft stickers
    [], // Roblox stickers
    [], // Pokemon stickers
    [], // Fortnite stickers
    [], // Among Us stickers
    []  // Fall Guys stickers
  ]
};

// Movie category definition
export const moviesCategory: CategoryData = {
  name: 'movies',
  title: 'Movies',
  subcategories: [
    { name: 'Action', color: categoryColors.neonRed },
    { name: 'Comedy', color: categoryColors.neonYellow },
    { name: 'Horror', color: categoryColors.neonPurple },
    { name: 'Sci-Fi', color: categoryColors.neonCyan },
    { name: 'Romance', color: categoryColors.neonPink },
    { name: 'Animated', color: categoryColors.neonOrange },
    { name: 'Classic', color: categoryColors.neonWhite },
    { name: 'Marvel', color: categoryColors.neonRed },
    { name: 'DC', color: categoryColors.neonAqua }
  ],
  stickerCollections: [
    [], // Action stickers
    [], // Comedy stickers
    [], // Horror stickers
    [], // Sci-Fi stickers
    [], // Romance stickers
    [], // Animated stickers
    [], // Classic stickers
    [], // Marvel stickers
    []  // DC stickers
  ]
};

// Trump category definition
export const trumpCategory: CategoryData = {
  name: 'trump',
  title: 'Trump',
  subcategories: [
    { name: 'MAGA', color: categoryColors.neonRed },
    { name: 'Patriotic', color: categoryColors.neonWhite },
    { name: 'Rally Signs', color: categoryColors.neonYellow },
    { name: 'Slogans', color: categoryColors.neonOrange },
    { name: 'Flags', color: categoryColors.neonAqua }
  ],
  stickerCollections: [
    [], // MAGA stickers
    [], // Patriotic stickers
    [], // Rally signs
    [], // Slogans
    [] // Flags
  ]
};

// Export all categories (Mario category temporarily removed to avoid circular imports)
export const allCategories = {
  gaming: gamingCategory,
  movies: moviesCategory,
  trump: trumpCategory
};

export type CategoryKey = keyof typeof allCategories;