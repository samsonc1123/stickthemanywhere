import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "../ui/logo";
import { CartIcon } from "../checkout/cart-icon";
import { Input } from "@/components/ui/input";
import { Menu, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();

  const navigationLinks = [
    { name: "Home", href: "/" },
    { name: "Categories", href: "/products" },
    { name: "Gallery", href: "/gallery" },
    { name: "New Arrivals", href: "/products/new-arrivals" },
    { name: "Deals", href: "/products/deals" },
    { name: "Contact", href: "/contact" }
  ];

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="relative z-10 py-4">
      <nav className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Logo />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navigationLinks.map((link) => (
              <Link key={link.name} href={link.href}>
                <div
                  className={`text-white hover:text-neon-blue transition-colors duration-300 cursor-pointer ${
                    location === link.href ? "text-neon-blue" : ""
                  }`}
                >
                  {link.name}
                </div>
              </Link>
            ))}
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                type="text" 
                placeholder="Search stickers..." 
                className="bg-light-gray text-white rounded-full py-2 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-neon-blue w-48"
              />
            </div>
            
            {/* Cart */}
            <CartIcon />
          </div>

          {/* Mobile Menu Button */}
          <Button
            onClick={toggleMenu}
            variant="ghost"
            className="md:hidden p-2 text-white"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="mt-4 p-4 bg-light-gray rounded-lg neon-border-blue md:hidden">
            <div className="flex flex-col space-y-3">
              {navigationLinks.map((link) => (
                <Link key={link.name} href={link.href}>
                  <div
                    className={`text-white hover:text-neon-blue transition-colors duration-300 cursor-pointer ${
                      location === link.href ? "text-neon-blue" : ""
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.name}
                  </div>
                </Link>
              ))}
              
              {/* Search Bar Mobile */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  type="text" 
                  placeholder="Search stickers..." 
                  className="bg-dark-gray text-white rounded-full py-2 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-neon-blue w-full"
                />
              </div>
              
              {/* Cart Mobile */}
              <div className="mt-3">
                <Link href="/checkout">
                  <a 
                    className="flex items-center text-white hover:text-neon-yellow transition-colors duration-300"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <CartIcon showText />
                  </a>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
