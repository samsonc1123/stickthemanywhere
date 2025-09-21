import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";

interface StickerDetailProps {
  stickerId: string;
}

export function StickerDetail({ stickerId }: StickerDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const { toast } = useToast();

  const { data: sticker, isLoading } = useQuery({
    queryKey: [`/api/stickers/${stickerId}`],
  });

  const handleAddToCart = () => {
    if (sticker) {
      addToCart(sticker, quantity);
      
      toast({
        title: "Added to cart!",
        description: `${quantity} x ${sticker.name} added to your cart`,
      });
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const increaseQuantity = () => {
    setQuantity(quantity + 1);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 pt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square w-full bg-dark-gray rounded-xl" />
          <div>
            <Skeleton className="h-8 w-3/4 mb-2 bg-dark-gray" />
            <Skeleton className="h-6 w-1/4 mb-4 bg-dark-gray" />
            <Skeleton className="h-20 w-full mb-6 bg-dark-gray" />
            <Skeleton className="h-10 w-full mb-4 bg-dark-gray" />
            <Skeleton className="h-12 w-full bg-dark-gray" />
          </div>
        </div>
      </div>
    );
  }

  if (!sticker) {
    return (
      <div className="container mx-auto p-4 pt-8">
        <div className="bg-dark-gray rounded-xl p-8 text-center">
          <h1 className="text-2xl text-white">Sticker not found</h1>
        </div>
      </div>
    );
  }

  const getBadgeClass = (category: string) => {
    switch (category) {
      case "Animals":
        return "bg-neon-pink bg-opacity-20";
      case "Nature":
        return "bg-neon-blue bg-opacity-20";
      case "Space":
        return "bg-neon-yellow bg-opacity-20";
      case "Abstract":
        return "bg-neon-pink bg-opacity-20";
      case "Gaming":
        return "bg-neon-purple bg-opacity-20";
      default:
        return "bg-neon-blue bg-opacity-20";
    }
  };

  return (
    <div className="container mx-auto p-4 pt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="relative">
          <div className="rounded-xl overflow-hidden neon-border-blue">
            <img 
              src={sticker.image} 
              alt={sticker.name} 
              className="w-full h-auto aspect-square object-cover"
            />
          </div>
          {/* Brand logo */}
          <div className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center">
            <img 
              src={sticker.brandLogo} 
              alt="Brand Logo" 
              className="w-8 h-8 object-contain" 
            />
          </div>
        </div>

        {/* Product Info */}
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge className={`${getBadgeClass(sticker.category)} text-white px-2 py-1 rounded-full`}>
              {sticker.category}
            </Badge>
            <Badge className="bg-light-gray text-white px-2 py-1 rounded-full">
              {sticker.subcategory}
            </Badge>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {sticker.name}
          </h1>

          <div className="flex items-center mb-4">
            <div className="flex items-center mr-4">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.floor(sticker.rating)
                        ? "text-neon-yellow fill-neon-yellow"
                        : "text-gray-400"
                    }`}
                  />
                ))}
            </div>
            <span className="text-gray-300">
              {sticker.rating.toFixed(1)} ({sticker.reviewCount} reviews)
            </span>
          </div>

          <p className="text-3xl font-bold text-neon-pink text-glow-pink mb-4">
            ${sticker.price.toFixed(2)}
          </p>

          <div className="mb-6">
            <p className="text-gray-300 mb-4">{sticker.description}</p>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>High-quality vinyl material</li>
              <li>Waterproof and UV resistant</li>
              <li>Perfect for laptops, water bottles, notebooks</li>
              <li>Dimensions: {sticker.dimensions}</li>
            </ul>
          </div>

          <div className="flex flex-col space-y-4">
            <div className="flex items-center">
              <Button
                onClick={decreaseQuantity}
                variant="outline"
                className="bg-light-gray h-10 w-10 rounded-l-lg"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="h-10 px-4 bg-dark-gray border-t border-b border-gray-700 flex items-center justify-center">
                <span className="text-white font-medium">{quantity}</span>
              </div>
              <Button
                onClick={increaseQuantity}
                variant="outline"
                className="bg-light-gray h-10 w-10 rounded-r-lg"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleAddToCart}
              className="bg-neon-blue hover:bg-opacity-80 text-black font-bold py-3 rounded-lg neon-button shadow-neon-blue w-full"
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
