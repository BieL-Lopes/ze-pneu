import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { brands } from "./brands";
import { categories } from "./categories";

/**
 * Modelo comercial do produto — "Michelin Primacy 4".
 *
 * A medida não vive aqui: ela é da variante. Isso permite uma página de
 * produto com seletor de medida e, ao mesmo tempo, páginas facetadas por
 * medida para SEO.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .notNull()
      .default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("products_status_idx").on(t.status)],
);
