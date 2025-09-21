import { useState, useEffect } from 'react';

interface CartItem {
  id: string;
  stickerId: string;
  name: string;
  imageUrl: string;
  price: string;
  quantity: number;
  customizations?: {
    effect?: string;
    size?: string;
  };
}

export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('stickerCart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('stickerCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (sticker: {
    id: string;
    name: string;
    imageUrl: string;
    basePrice: string;
  }, customizations?: any) => {
    const cartItem: CartItem = {
      id: `${sticker.id}-${Date.now()}`,
      stickerId: sticker.id,
      name: sticker.name,
      imageUrl: sticker.imageUrl,
      price: sticker.basePrice,
      quantity: 1,
      customizations
    };

    setCartItems(prev => [...prev, cartItem]);
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCartItems(prev => 
      prev.map(item => 
        item.id === cartItemId 
          ? { ...item, quantity }
          : item
      )
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== cartItemId));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      return total + (parseFloat(item.price) * item.quantity);
    }, 0).toFixed(2);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return {
    cartItems,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalPrice,
    getTotalItems
  };
}