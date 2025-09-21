import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User registration and customer data
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone"),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  isAdmin: boolean("is_admin").default(false), // Admin flag for access control
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Categories for sticker organization
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subcategories for precise sticker classification
export const subcategories = pgTable("subcategories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  name: varchar("name").notNull(),
  description: text("description"),
  boxPosition: integer("box_position").notNull(), // 1, 2, or 3 for correlation
  createdAt: timestamp("created_at").defaultNow(),
});

// Sticker inventory - only stickers actually displayed in boxes
export const stickers = pgTable("stickers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  subcategoryId: varchar("subcategory_id").notNull().references(() => subcategories.id),
  name: varchar("name").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url").notNull(),
  imageFileName: varchar("image_file_name").notNull(), // For printer reference
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stickerType: varchar("sticker_type").notNull(), // "static_pvc" or "laminated_vinyl"
  size: varchar("size").default("2x3"), // Default 2"x3"
  isActive: boolean("is_active").default(true),
  boxPosition: integer("box_position").notNull(), // Which box (1, 2, 3)
  displayOrder: integer("display_order").notNull(), // Order within the box
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orderNumber: varchar("order_number").notNull().unique(),
  status: varchar("status").notNull().default("pending"), // pending, processing, shipped, delivered
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  shipping: decimal("shipping", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items - detailed info for printing
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  stickerId: varchar("sticker_id").notNull().references(() => stickers.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  stickerName: varchar("sticker_name").notNull(), // Snapshot for printing
  stickerType: varchar("sticker_type").notNull(), // Snapshot for printing
  imageFileName: varchar("image_file_name").notNull(), // For printer
  createdAt: timestamp("created_at").defaultNow(),
});

// Shopping cart (temporary storage)
export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Null for guest carts
  sessionId: varchar("session_id"), // For guest users
  stickerId: varchar("sticker_id").notNull().references(() => stickers.id),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for database joins
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  cartItems: many(cartItems),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  subcategories: many(subcategories),
  stickers: many(stickers),
}));

export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
  stickers: many(stickers),
}));

export const stickersRelations = relations(stickers, ({ one, many }) => ({
  category: one(categories, {
    fields: [stickers.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [stickers.subcategoryId],
    references: [subcategories.id],
  }),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  sticker: one(stickers, {
    fields: [orderItems.stickerId],
    references: [stickers.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  sticker: one(stickers, {
    fields: [cartItems.stickerId],
    references: [stickers.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type Subcategory = typeof subcategories.$inferSelect;
export type InsertSubcategory = typeof subcategories.$inferInsert;
export type Sticker = typeof stickers.$inferSelect;
export type InsertSticker = typeof stickers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// GitHub API validation schemas
export const createRepositorySchema = z.object({
  name: z.string().min(1, "Repository name is required").max(100),
  description: z.string().optional(),
  private: z.boolean().optional().default(false),
});

export const createIssueSchema = z.object({
  title: z.string().min(1, "Issue title is required").max(256),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export const repositoryParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  per_page: z.coerce.number().min(1).max(100).optional().default(30),
});

export const issueStateSchema = z.object({
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
});

export const dateRangeSchema = z.object({
  date: z.string().optional(),
});

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type RepositoryParams = z.infer<typeof repositoryParamsSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type IssueStateParams = z.infer<typeof issueStateSchema>;
export type DateRangeParams = z.infer<typeof dateRangeSchema>;