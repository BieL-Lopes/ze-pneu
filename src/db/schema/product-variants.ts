import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { products } from "./products";

/**
 * SKU vendável. Para pneu, carrega a medida e os índices; para acessório, a
 * especificação de pneu fica nula.
 *
 * Peso e dimensões são obrigatórios porque a cotação de frete depende deles —
 * um SKU sem peso torna o produto invendável, então o banco recusa.
 */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    ean: text("ean"),
    priceCents: integer("price_cents").notNull(),

    // Especificação de pneu. Nula em acessórios.
    width: integer("width"),
    profile: integer("profile"),
    rim: integer("rim"),
    loadIndex: integer("load_index"),
    speedRating: text("speed_rating"),
    vehicleType: text("vehicle_type", {
      enum: ["passeio", "suv", "carga", "moto"],
    }),

    // Necessários para cotar frete.
    weightGrams: integer("weight_grams").notNull(),
    lengthMm: integer("length_mm").notNull(),
    widthMm: integer("width_mm").notNull(),
    heightMm: integer("height_mm").notNull(),

    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("variants_size_idx").on(t.width, t.profile, t.rim),
    index("variants_product_idx").on(t.productId),
  ],
);
