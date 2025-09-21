import { Link } from "wouter";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";

interface CartIconProps {
  showText?: boolean;
}

export function CartIcon({ showText = false }: CartIconProps) {
  const { cart } = useCart();
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <Link href="/checkout">
      <div className="relative p-2 text-white hover:text-neon-pink transition-colors duration-300 flex items-center cursor-pointer">
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <span className="absolute top-0 right-0 bg-neon-pink text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {itemCount}
          </span>
        )}
        {showText && (
          <span className="ml-2">Cart ({itemCount})</span>
        )}
      </div>
    </Link>
  );
}
