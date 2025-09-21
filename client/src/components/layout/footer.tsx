import { Link } from "wouter";
import { Logo } from "../ui/logo";
import { 
  Instagram, 
  Twitter, 
  Facebook, 
  Linkedin, 
  Mail, 
  Phone, 
  MapPin 
} from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-dark-gray mt-16">
      <div className="container mx-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <Logo size="lg" />
            <p className="text-gray-400 my-4">
              The ultimate destination for high-quality, vibrant neon stickers that make a statement.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-neon-pink transition-colors duration-300">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-neon-blue transition-colors duration-300">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-neon-yellow transition-colors duration-300">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-neon-purple transition-colors duration-300">
                <Linkedin size={20} />
              </a>
            </div>
          </div>
          
          {/* Categories */}
          <div>
            <h4 className="text-white font-bold mb-4">Categories</h4>
            <ul className="space-y-2">
              <li><Link href="/products/animals"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Animals</a></Link></li>
              <li><Link href="/products/nature"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Nature</a></Link></li>
              <li><Link href="/products/abstract"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Abstract</a></Link></li>
              <li><Link href="/products/space"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Space</a></Link></li>
              <li><Link href="/products/gaming"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Gaming</a></Link></li>
              <li><Link href="/products/emoji"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Emojis</a></Link></li>
            </ul>
          </div>
          
          {/* Information */}
          <div>
            <h4 className="text-white font-bold mb-4">Information</h4>
            <ul className="space-y-2">
              <li><Link href="/about"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">About Us</a></Link></li>
              <li><Link href="/contact"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Contact Us</a></Link></li>
              <li><Link href="/faq"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">FAQ</a></Link></li>
              <li><Link href="/privacy"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Privacy Policy</a></Link></li>
              <li><Link href="/terms"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Terms of Service</a></Link></li>
              <li><Link href="/shipping"><a className="text-gray-400 hover:text-neon-blue transition-colors duration-300">Shipping Policy</a></Link></li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h4 className="text-white font-bold mb-4">Contact Us</h4>
            <ul className="space-y-2">
              <li className="flex items-center text-gray-400">
                <Mail className="mr-2 h-4 w-4" />
                <span>support@stickthemanywhere.com</span>
              </li>
              <li className="flex items-center text-gray-400">
                <Phone className="mr-2 h-4 w-4" />
                <span>+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center text-gray-400">
                <MapPin className="mr-2 h-4 w-4" />
                <span>123 Neon Street, Glow City</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-700 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm mb-4 md:mb-0">
            © {currentYear} StickThemAnywhere. All rights reserved.
          </p>
          <div className="flex items-center space-x-4">
            <Link href="/privacy"><a className="text-gray-500 hover:text-neon-blue transition-colors duration-300 text-sm">Privacy Policy</a></Link>
            <span className="text-gray-700">|</span>
            <Link href="/terms"><a className="text-gray-500 hover:text-neon-blue transition-colors duration-300 text-sm">Terms of Service</a></Link>
            <span className="text-gray-700">|</span>
            <Link href="/sitemap"><a className="text-gray-500 hover:text-neon-blue transition-colors duration-300 text-sm">Sitemap</a></Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
