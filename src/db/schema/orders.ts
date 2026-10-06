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

export const DELIVERY_METHODS = ["retirada", "entrega"] as const;

export const PAYMENT_STATUSES = [
  "pendente",
  "aprovado",
  "recusado",
  "estornado",
] as const;

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
    trackingCode: text("tracking_code"),

    // Segredo do link de acompanhamento. A referência sozinha é curta e
    // adivinhável, e a página do pedido mostra nome e endereço do comprador.
    accessToken: text("access_token").notNull().unique(),

    deliveryMethod: text("delivery_method", { enum: DELIVERY_METHODS })
      .notNull()
      .default("retirada"),
    // Endereço e frete só existem na entrega.
    shippingPostalCode: text("shipping_postal_code"),
    shippingStreet: text("shipping_street"),
    shippingNumber: text("shipping_number"),
    shippingComplement: text("shipping_complement"),
    shippingDistrict: text("shipping_district"),
    shippingCity: text("shipping_city"),
    shippingState: text("shipping_state"),
    shippingServiceId: text("shipping_service_id"),
    shippingServiceName: text("shipping_service_name"),
    shippingCarrier: text("shipping_carrier"),
    shippingDeadlineDays: integer("shipping_deadline_days"),

    itemsTotalCents: integer("items_total_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),

    // Carrinho de origem, esvaziado só quando o pagamento é aprovado: se o
    // cliente desistir no Mercado Pago, volta à loja com o carrinho intacto.
    cartToken: text("cart_token"),
    paymentUrl: text("payment_url"),
    // Depois disto, sem pagamento, o pedido é cancelado e o estoque volta.
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("pedidos_por_status").on(t.status, t.createdAt),
    index("pedidos_vencendo").on(t.status, t.expiresAt),
  ],
);

/**
 * Um registro por pagamento do provedor.
 *
 * O mesmo pedido pode ter vários: o cliente tem o Pix recusado e paga no
 * cartão na mesma cobrança. O id do provedor é único, então a notificação
 * repetida atualiza o registro em vez de duplicar.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull(),
    method: text("method"),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("pagamento_por_provedor").on(t.provider, t.providerPaymentId),
    index("pagamentos_por_pedido").on(t.orderId),
  ],
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
