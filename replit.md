# sticker canvas - Neon Sticker Shop

## Overview
sticker canvas is an e-commerce web application for selling vibrant neon stickers. It features a dark theme with neon accents, providing an immersive visual experience. Built with React and Express, it offers product browsing, cart management, and checkout functionalities. The project's vision is to offer a unique online shopping experience, leveraging striking visual design to enhance product appeal and market a distinct product line.

## Business Operations Model
- **Online Store Management**: User handles website, orders, customer service, and shipping fulfillment
- **Print Production**: Next-door neighbor operates commercial sticker printer and handles all print production
- **Workflow**: Orders → Automated feed to printer → Pickup → User ships to customers
- **Equipment**: Commercial-grade sticker printer capable of Static PVC ($4.00) and Laminated Vinyl ($5.00) production

## User Preferences
Preferred communication style: Simple, everyday language.
Code style: Prefers inline styling and component-based architecture for neon effects. Uses simple function declaration syntax (export default function) over const with arrow functions. Organizes component-specific CSS in separate files (e.g., HomePage.css) with modular styling approach.
Design preference: Clean JSX structure with minimal CSS classes, favoring style objects.
CRITICAL UI RULE: Never change the existing homepage interface layout that user spent hours/days crafting - must maintain single row sticker squares, perforated background, exact title styling, and horizontal scrolling category buttons. User interface changes are strictly forbidden.
TYPOGRAPHY STANDARD: All yellow subtitle/subheader text across ALL pages must use Audiowide font at 18px (text-lg class). All category and subcategory buttons across ALL pages must use Montserrat font (font-montserrat class). These patterns must be maintained for all future pages.
LAYOUT STANDARDS: All category pages must follow consistent structure - titles positioned 3 perforation rows down (72px margin), subcategory buttons above sticker boxes, large sticker boxes (w-40 h-40) centered on page matching homepage layout exactly.

HOMEPAGE BLUEPRINT STRUCTURE: All pages must follow the exact 4-section structure:
HOMEPAGE: 
1. Title: "Stick Them Anywhere" (mb-3 lg:mb-2)
2. Subtitle: "Browse Categories" with split animation (mb-4 lg:mb-1) 
3. Category buttons (mb-3 lg:mb-2)
4. Sticker boxes (border-4 neon-border-cyan, w-40 h-40 landscape:w-36 landscape:h-36)

CATEGORY PAGES:
1. Title: "Stick Them Anywhere" (mb-3 lg:mb-2)
2. Category Title: "[Category Name]" (text-lg font-audiowide animate-categoriesFlicker, mb-4 lg:mb-1) 
3. Subcategory buttons (mb-3 lg:mb-2)
4. Sticker boxes (border-4 neon-border-cyan, w-40 h-40 landscape:w-36 landscape:h-36)

Logic: Only homepage says "Browse Categories" since users browse from there. Category pages show the current category name without "Browse" since users are already browsing within that category.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: React hooks with local storage for cart persistence
- **Data Fetching**: TanStack React Query
- **UI Components**: Custom component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom neon theme colors and effects, incorporating Google Fonts (Pacifico, Dancing Script, Orbitron, Inter) and custom CSS for neon/flicker animations.
- **UI/UX Decisions**: Dark theme with a neon color palette (pink, blue, purple, yellow, green, red, orange, white, cyan, fuchsia), 3D hover effects, glow animations, responsive grid layouts, and custom typography. Specific design elements include animated starfield backgrounds, subcategory bars with cycling neon colors, and custom header components with bouncing animations.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **API Design**: RESTful API for products, categories, and orders.
- **Development**: TypeScript with ESBuild for bundling.

### Data Storage Strategy
- **Primary Database**: PostgreSQL via Neon serverless (migrating to Supabase).
- **ORM**: Drizzle.
- **File Storage**: Firebase Storage for product images (will migrate to Supabase Storage).
- **Session Storage**: Local storage for cart persistence.
- **Caching**: React Query for client-side data caching.
- **Migration Plan**: Scheduled Supabase migration for built-in authentication, real-time subscriptions, auto-generated APIs, and integrated file storage.

### Database Schema
- **Categories**: Main product categories.
- **Subcategories**: Nested categories.
- **Stickers**: Product catalog.
- **Orders**: Customer order tracking.
- **Cart Items**: Temporary user selections.

### System Design Choices
- **Product Management**: Category-based navigation with visual color coding, featured products, search, and filtering.
- **Shopping Experience**: Interactive product cards, real-time cart updates, persistent cart state, and streamlined checkout.
- **Responsive Design**: Implementation of responsive grid layouts, horizontal title layouts for landscape mode, and touch-friendly scrolling for mobile UX.
- **Component-based Design**: Emphasis on reusable components like `Header`, `SubcategoriesBar`, and dedicated category pages (e.g., `ChristianPage`, `GamingPage`, `FloralPage`).

## External Dependencies

### Core Framework Dependencies
- React (React, ReactDOM, React Query)
- Express.js
- Drizzle ORM
- Wouter

### UI and Styling
- Tailwind CSS
- Radix UI
- Lucide React
- Google Fonts (Pacifico, Dancing Script, Orbitron, Inter, Audiowide, Montserrat)

### Development Tools
- TypeScript
- Vite
- ESBuild

### External Services
- Neon Database (PostgreSQL hosting)
- Firebase (image storage)

## Recent Changes
- **COMPLETED**: Full e-commerce backend system with PostgreSQL database
- **COMPLETED**: Precise inventory tracking system that counts ONLY stickers displayed in boxes (53 total: Box 1=15, Box 2=19, Box 3=19)
- **COMPLETED**: Complete order management system with unique order numbers (STA-{timestamp}-{random} format)
- **COMPLETED**: Customer registration system capturing all user data (name, email, phone, address)
- **COMPLETED**: Daily business report system accessible at `/admin/daily-report` with comprehensive printing information
- **COMPLETED**: Box correlation system maintains exact button position = box position relationship
- **COMPLETED**: Database schema includes users, orders, order_items, stickers, categories, subcategories, cart_items
- **COMPLETED**: API endpoints for inventory counting, daily reports, order management, and customer tracking
- **COMPLETED**: Printer-ready data capture (imageFileName, stickerType, quantity, customer details) for daily operations
- **COMPLETED**: Standardized pricing: $4.00 Static PVC, $5.00 Laminated Vinyl with quantity discounts
- **COMPLETED**: Database synchronized with current Floral page inventory (August 17, 2025)
- **COMPLETED**: Anime subtitles alphabetical organization system by first and second letters (August 17, 2025)
- **COMPLETED**: Automatic sorting utilities with interactive management for adding new anime titles
- **COMPLETED**: Visual position preview system shows where new items will be inserted
- **COMPLETED**: Marijuana category with green Cannabis subcategory and manual navigation (August 19, 2025)
- **COMPLETED**: Transparent button text effects and Exo2 font implementation across all category buttons
- **COMPLETED**: Audiowide font standardization - all yellow subtitle/subheader text now uses Audiowide at 18px across all pages (August 19, 2025)
- **COMPLETED**: Montserrat font standardization - all category and subcategory buttons now use Montserrat font across all pages (August 19, 2025)

- **PLANNED**: Migration from Neon Database to Supabase (scheduled for ~10 days after subscription upgrade)
- **PLANNED**: Photo loading phase beginning this month for complete sticker inventory
- **PLANNED**: Automated order feeding system to commercial printer (neighbor's print shop integration)
- **PLANNED**: Print queue management and pickup notification system
- Preserved original homepage interface layout as explicitly requested by user