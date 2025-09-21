import { CheckoutForm } from "@/components/checkout/checkout-form";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trash2, Plus, Minus } from "lucide-react";
import { Helmet } from "react-helmet";

export default function Checkout() {
  const { cart, updateQuantity, removeFromCart, total } = useCart();

  if (cart.length === 0) {
    return (
      <div className="container mx-auto p-4 pt-8">
        <Helmet>
          <title>Your Cart - StickThemAnywhere</title>
          <meta name="description" content="View your shopping cart and checkout." />
        </Helmet>
        
        <div className="bg-dark-gray rounded-xl p-8 text-center max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">Your Cart is Empty</h1>
          <p className="text-gray-300 mb-6">Looks like you haven't added any stickers to your cart yet.</p>
          <Link href="/products">
            <Button className="bg-neon-blue hover:bg-opacity-80 text-black font-bold py-3 rounded-lg neon-button shadow-neon-blue">
              Browse Stickers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pt-8">
      <Helmet>
        <title>Your Cart - StickThemAnywhere</title>
        <meta name="description" content="View your shopping cart and checkout." />
      </Helmet>
      
      <h1 className="text-3xl font-bold text-white mb-8">Your Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-7">
          <div className="bg-dark-gray rounded-xl p-6">
            <div className="space-y-4">
              {cart.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center border-b border-gray-700 pb-4 last:border-0 last:pb-0"
                >
                  <div className="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="h-full w-full object-cover"
                    />
                  </div>
                  
                  <div className="ml-4 flex-grow">
                    <h3 className="text-white font-medium">{item.name}</h3>
                    <p className="text-gray-400 text-sm">{item.category} / {item.subcategory}</p>
                    <p className="text-neon-pink font-bold mt-1">${item.price.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center">
                    <button
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="h-8 w-8 flex items-center justify-center bg-light-gray rounded-l text-white"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <div className="h-8 w-10 flex items-center justify-center bg-dark text-white border-t border-b border-gray-700">
                      {item.quantity}
                    </div>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="h-8 w-8 flex items-center justify-center bg-light-gray rounded-r text-white"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="ml-4 text-gray-400 hover:text-neon-pink"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between">
              <Link href="/products">
                <Button 
                  variant="link" 
                  className="text-neon-blue px-0 hover:no-underline"
                >
                  ← Continue Shopping
                </Button>
              </Link>
              <div className="text-right">
                <p className="text-gray-400">Subtotal</p>
                <p className="text-xl font-bold text-white">${total.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Checkout Form */}
        <div className="lg:col-span-5">
          <CheckoutForm />
        </div>
      </div>
    </div>
  );
}
