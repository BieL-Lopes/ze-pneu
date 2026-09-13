import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants";

export const ORDER_STATUSES = [
  "aguardando_pagamento",
  "pago",
  "em_separacao",
  "enviado",
  "pronto_para_retirada",
  "entregue",
  "retirado",
  "cancelado",
  "estornado",
] as const;

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Referência curta que o cliente informa no WhatsApp.
    reference: text("reference").notNull().unique(),
    status: text("status", { enum: ORDER_STATUSES })
      .notNull()
      .default("aguardando_pagamento"),

    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    // Campos fiscais preenchíveis à mão enquanto não há emissor de NF-e.
    customerDocument: text("customer_document"),
    invoiceNumber: text("invoice_number"),
    invoiceKey: text("invoice_key"),

    itemsTotalCents: integer("items_total_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("pedidos_por_status").on(t.status, t.createdAt)],
);

/**
 * O item guarda nome, SKU e preço copiados no momento da compra.
 *
 * Referenciar a variante não basta: se o preço ou o nome mudar depois, o pedido
 * antigo precisa continuar mostrando o que o cliente realmente comprou.
 */
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  sizeLabel: text("size_label"),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
});

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status", { enum: ORDER_STATUSES }).notNull(),
    note: text("note"),
    authorId: text("author_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("eventos_por_pedido").on(t.orderId, t.createdAt)],
);
