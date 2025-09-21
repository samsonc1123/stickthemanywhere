import { Link } from "wouter";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNeonEffect } from "@/lib/neon-effects";

interface StickerCardProps {
  sticker: {
    id: number;
    name: string;
    price: number;
    image: string;
    category: string;
    subcategory: string;
    rating: number;
    brandLogo: string;
    badge?: {
      text: string;
      color: "blue" | "pink" | "purple" | "yellow";
    };
  };
}

export function StickerCard({ sticker }: StickerCardProps) {
  const cardRef = useNeonEffect();
  
  // Determine border color based on category
  const getBorderClass = () => {
    switch (sticker.category) {
      case "Animals":
        return "neon-border-pink";
      case "Nature":
        return "neon-border-blue";
      case "Space":
        return "neon-border-yellow";
      case "Abstract":
        return "neon-border-pink";
      case "Gaming":
        return "neon-border-purple";
      default:
        return "neon-border-blue";
    }
  };

  // Determine badge background color
  const getBadgeClass = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-neon-blue bg-opacity-20";
      case "pink":
        return "bg-neon-pink bg-opacity-20";
      case "purple":
        return "bg-neon-purple bg-opacity-20";
      case "yellow":
        return "bg-neon-yellow bg-opacity-20";
      default:
        return "bg-neon-blue bg-opacity-20";
    }
  };

  return (
    <Link href={`/product/${sticker.id}`}>
      <a className="block">
        <div 
          ref={cardRef}
          className={`sticker-card card-3d-effect bg-dark-gray rounded-xl overflow-hidden ${getBorderClass()} aspect-square`}
        >
          <div className="relative h-3/4">
            <img 
              src={sticker.image} 
              alt={sticker.name} 
              className="w-full h-full object-cover rounded-t-xl" 
            />
            
            {sticker.badge && (
              <div className={`absolute top-3 left-3 ${getBadgeClass(sticker.badge.color)} backdrop-blur-sm p-1 rounded`}>
                <span className="text-xs font-semibold text-white px-2">{sticker.badge.text}</span>
              </div>
            )}
            
            <div className="absolute bottom-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <img 
                src={sticker.brandLogo} 
                alt="Brand Logo" 
                className="w-6 h-6 object-contain" 
              />
            </div>
          </div>
          
          <div className="p-3 h-1/4 flex flex-col justify-between">
            <h3 className="font-poppins font-semibold text-white text-sm leading-tight">{sticker.name}</h3>
            
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="text-xs bg-neon-blue bg-opacity-20 text-white px-2 py-1 rounded-full">
                {sticker.category}
              </Badge>
              <div className="flex items-center">
                <Star className="text-neon-yellow fill-neon-yellow h-3 w-3 mr-1" />
                <span className="text-xs text-gray-300">{sticker.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </a>
    </Link>
  );
}
