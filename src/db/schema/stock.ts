import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants";

export const stockLocations = pgTable("stock_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  city: text("city").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Saldo por SKU e local.
 *
 * É um agregado mantido dentro da mesma transação que grava o movimento, nunca
 * a fonte da verdade sozinho: pode ser reconstruído somando stock_movements.
 */
export const stockBalances = pgTable(
  "stock_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => stockLocations.id),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("saldo_por_sku_local").on(t.variantId, t.locationId)],
);

/** Livro-razão. Só INSERT: linha gravada nunca é alterada nem apagada. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => stockLocations.id),
    kind: text("kind", {
      enum: ["entrada", "reserva", "liberacao", "baixa", "estorno", "ajuste"],
    }).notNull(),
    quantity: integer("quantity").notNull(),
    reason: text("reason"),
    // Referência do pedido ("ZP-XXXXXXXX"), não o uuid: a reserva nasce antes
    // do pedido existir, então não há uuid para apontar nesse momento.
    orderRef: text("order_ref"),
    authorId: text("author_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("movimentos_por_sku").on(t.variantId, t.createdAt)],
);

export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => stockLocations.id),
    // Mesma razão do movimento: a referência do pedido, não um uuid.
    orderRef: text("order_ref").notNull(),
    quantity: integer("quantity").notNull(),
    status: text("status", { enum: ["ativa", "consumida", "liberada"] })
      .notNull()
      .default("ativa"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("reservas_vencendo").on(t.status, t.expiresAt)],
);
