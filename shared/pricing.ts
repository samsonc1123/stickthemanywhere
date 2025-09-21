// Pricing structure for Stick Them Anywhere stickers

export interface PricingTier {
  quantity: number;
  totalPrice: number;
  pricePerSticker: number;
  savings?: number;
  isPopular?: boolean;
}

// Standard 2"x3" Static Clean PVC sticker pricing
export const STANDARD_STICKER_PRICING: PricingTier[] = [
  {
    quantity: 1,
    totalPrice: 4.00,
    pricePerSticker: 4.00
  },
  {
    quantity: 3,
    totalPrice: 10.00,
    pricePerSticker: 3.33,
    savings: 2.00,
    isPopular: true
  },
  {
    quantity: 8,
    totalPrice: 20.00,
    pricePerSticker: 2.50,
    savings: 12.00
  }
];

// Laminated vinyl stickers pricing (same quantity structure)
export const LAMINATED_VINYL_PRICING: PricingTier[] = [
  {
    quantity: 1,
    totalPrice: 5.00,
    pricePerSticker: 5.00
  },
  {
    quantity: 3,
    totalPrice: 10.00,
    pricePerSticker: 3.33,
    savings: 5.00,
    isPopular: true
  },
  {
    quantity: 8,
    totalPrice: 20.00,
    pricePerSticker: 2.50,
    savings: 20.00
  }
];

export const BASE_STICKER_PRICE = 4.00; // Static Clean PVC base price
export const LAMINATED_VINYL_PRICE = 5.00; // Laminated vinyl base price
export const STICKER_SIZE_STANDARD = '2"x3"';
export const STICKER_MATERIAL_PVC = 'Static Clean PVC';
export const STICKER_MATERIAL_VINYL = 'Laminated Vinyl';

// Calculate best pricing for quantity
export function calculatePricing(quantity: number): {
  totalPrice: number;
  pricePerSticker: number;
  savings: number;
  appliedTier: PricingTier;
} {
  // Find the best tier that applies
  let bestTier = STANDARD_STICKER_PRICING[0];
  
  for (const tier of STANDARD_STICKER_PRICING) {
    if (quantity >= tier.quantity) {
      bestTier = tier;
    }
  }
  
  const singlePrice = quantity * BASE_STICKER_PRICE;
  const tierPrice = Math.ceil(quantity / bestTier.quantity) * bestTier.totalPrice;
  
  return {
    totalPrice: tierPrice,
    pricePerSticker: tierPrice / quantity,
    savings: singlePrice - tierPrice,
    appliedTier: bestTier
  };
}