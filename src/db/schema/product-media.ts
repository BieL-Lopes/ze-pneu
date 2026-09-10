import { pgTable, uuid, text, integer, index } from "drizzle-orm/pg-core";
import { products } from "./products";

export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("media_product_idx").on(t.productId, t.position)],
);
