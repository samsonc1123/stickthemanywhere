# sticker canvas - Neon Sticker Shop

## Overview
sticker canvas is an e-commerce web application for selling vibrant neon stickers. It features a dark theme with neon accents, providing an immersive visual experience. The project aims to offer a unique online shopping experience, leveraging striking visual design to enhance product appeal and market a distinct product line. Key capabilities include product browsing, cart management, and checkout functionalities.

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

### Runtime
- **Default Runtime**: Bun 1.2 (replaces Node.js/npm)
- **Package Manager**: Bun (lockfile: `bun.lockb` at repo root, `client/bun.lockb` in client)
- **No npm, no npx**: use `bun`, `bun run`, `bunx` everywhere

### Development Commands
```bash
# Install dependencies (run in both root and client/)
bun install

# Start frontend dev server (Replit workflow)
cd client && bunx vite --port 5000 --host 0.0.0.0

# Run Convex backend in watch mode
bunx convex dev

# Deploy Convex to production
bunx convex deploy
```

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (served directly, no Express layer in dev)
- **Routing**: Wouter
- **State Management**: React hooks with local storage for cart persistence
- **Data Fetching**: TanStack React Query
- **UI Components**: Custom component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom neon theme colors and effects, incorporating Google Fonts (Pacifico, Dancing Script, Orbitron, Inter, Audiowide, Montserrat) and custom CSS for neon/flicker animations.
- **UI/UX Decisions**: Dark theme with a neon color palette, 3D hover effects, glow animations, responsive grid layouts, and custom typography. Specific design elements include animated starfield backgrounds, subcategory bars with cycling neon colors, and custom header components with bouncing animations. Responsive design includes specific sizing for iPhone/iPad and adaptive grid layouts.

### Backend Architecture
- **Runtime**: Bun 1.2 (native TypeScript, replaces Node.js + tsx)
- **Convex**: Primary backend (queries, mutations, actions, file storage)
- **Express.js**: Legacy server kept for build/production serving only
- **Database**: PostgreSQL with Drizzle ORM
- **Development**: TypeScript runs natively in Bun without tsx

### Data Storage Strategy
- **Primary Database**: PostgreSQL (currently Neon, migrating to Supabase).
- **ORM**: Drizzle.
- **File Storage**: Firebase Storage for product images (migrating to Supabase Storage).
- **Session Storage**: Local storage for cart persistence.
- **Caching**: React Query for client-side data caching.
- **Migration Plan**: Scheduled Supabase migration for built-in authentication, real-time subscriptions, auto-generated APIs, and integrated file storage.

### Database Schema
- **Categories**: Main product categories.
- **Subcategories**: Nested categories.
- **Stickers**: Product catalog.
- **Orders**: Customer order tracking.
- **Cart Items**: Temporary user selections.
- **Users**: Customer registration data.

### System Design Choices
- **Product Management**: Category-based navigation with visual color coding, featured products, search, and filtering. Taxonomy standardization with canonical codes (uppercase, hyphen-delimited).
- **Shopping Experience**: Interactive product cards, real-time cart updates, persistent cart state, and streamlined checkout. Inventory tracking and order management system with unique order numbering.
- **Responsive Design**: Implementation of responsive grid layouts, horizontal title layouts for landscape mode, and touch-friendly scrolling for mobile UX.
- **Component-based Design**: Emphasis on reusable components like `Header`, `SubcategoriesBar`, and dedicated category pages.
- **Business Operations**: Automated feed to printer for order fulfillment, daily business reports, and printer-ready data capture.
- **Taxonomy Management**: Implemented a canonical taxonomy sheriff for standardizing category and subcategory codes across the system.

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
- Convex (for admin uploader, specifically uploads and sticker finalization)