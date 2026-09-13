# Estoque, Carrinho e Pedido — Plano de Implementação (Plano 2 de 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o cliente monte um carrinho e gere um pedido com estoque reservado, sem nunca vender duas vezes o mesmo pneu.

**Architecture:** Estoque é um livro-razão: todo movimento vira linha em `stock_movements` e o saldo em `stock_balances` é mantido dentro da mesma transação, protegido por `SELECT ... FOR UPDATE` na linha do SKU. O checkout cria reserva com expiração, não baixa. O pedido é uma máquina de estados pura, testável sem banco, com cada transição gravada em `order_events`.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Drizzle ORM, Postgres, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-ecommerce-fase1-design.md`

**Plano anterior:** `docs/superpowers/plans/2026-09-10-fundacao-e-catalogo.md`

## Global Constraints

- **`src/core/**` não importa de `src/app/**`, `src/db/**`, `next`, `react`, `drizzle-orm` nem `postgres`.** Regra de ESLint já ativa; ela falha o build.
- **Estoque nunca por `UPDATE saldo = saldo - 1`.** Toda alteração grava movimento e o saldo é atualizado na mesma transação, sob trava de linha.
- Domínio devolve `Result<T, E>` para falha esperada; exceção só para o inesperado.
- Valores monetários em centavos, inteiros.
- Todo texto visível ao usuário em português do Brasil.
- TDD: teste falhando primeiro, sempre. Commit ao fim de cada tarefa.
- Reserva expira em **30 minutos**.
- Testes de integração exigem `DATABASE_URL_TEST` e um Postgres real. `docker compose up -d` sobe o banco local.

---

## Estrutura de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/db/schema/stock.ts` | `stock_locations`, `stock_balances`, `stock_movements`, `stock_reservations` |
| `src/db/schema/carts.ts` | `carts`, `cart_items` |
| `src/db/schema/orders.ts` | `orders`, `order_items`, `order_events` |
| `src/core/orders/order-status.ts` | Máquina de estados do pedido (pura) |
| `src/core/stock/types.ts` | Tipos de estoque e motivos de movimento |
| `src/core/stock/stock-repository.ts` | Porta de estoque |
| `src/core/cart/types.ts` | Tipos de carrinho |
| `src/core/cart/cart-totals.ts` | Cálculo do carrinho (puro) |
| `src/core/cart/cart-repository.ts` | Porta de carrinho |
| `src/core/orders/order-repository.ts` | Porta de pedido |
| `src/core/orders/checkout-service.ts` | Cria pedido a partir do carrinho, reservando estoque |
| `src/db/repositories/drizzle-stock-repository.ts` | Livro-razão com transação e trava |
| `src/db/repositories/drizzle-cart-repository.ts` | Carrinho |
| `src/db/repositories/drizzle-order-repository.ts` | Pedido |
| `src/app/(loja)/carrinho/page.tsx` | Página do carrinho |
| `src/app/(loja)/carrinho/acoes.ts` | Server Actions do carrinho |
| `src/lib/cart-cookie.ts` | Identidade do carrinho de visitante |
| `src/app/api/cron/liberar-reservas/route.ts` | Rotina que libera reserva vencida |

---

### Task 1: Schema de estoque, carrinho e pedido

**Files:**
- Create: `src/db/schema/stock.ts`, `src/db/schema/carts.ts`, `src/db/schema/orders.ts`
- Modify: `src/db/schema/index.ts`
- Create: `drizzle/0001_*.sql` (gerado)

**Interfaces:**
- Consumes: `productVariants` (Plano 1)
- Produces: tabelas `stock_locations`, `stock_balances`, `stock_movements`, `stock_reservations`, `carts`, `cart_items`, `orders`, `order_items`, `order_events`

- [ ] **Step 1: Escrever o schema de estoque**

Criar `src/db/schema/stock.ts`:

```ts
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
 * Saldo por SKU e local. É um agregado mantido dentro da mesma transação que
 * grava o movimento, nunca a fonte da verdade sozinha: pode ser reconstruído
 * somando stock_movements.
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
```

- [ ] **Step 2: Escrever o schema de carrinho**

Criar `src/db/schema/carts.ts`:

```ts
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

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("carrinhos_por_token").on(t.token)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("um_item_por_sku_no_carrinho").on(t.cartId, t.variantId)],
);
```

- [ ] **Step 3: Escrever o schema de pedido**

Criar `src/db/schema/orders.ts`:

```ts
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
    // Número curto que o cliente informa no WhatsApp.
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
 * O item guarda nome, SKU e preço copiados no momento da compra. Referenciar
 * a variante não basta: se o preço ou o nome mudar depois, o pedido antigo
 * precisa continuar mostrando o que o cliente realmente comprou.
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
```

- [ ] **Step 4: Exportar os schemas novos**

Substituir `src/db/schema/index.ts`:

```ts
export * from "./brands";
export * from "./categories";
export * from "./products";
export * from "./product-variants";
export * from "./product-media";
export * from "./stock";
export * from "./carts";
export * from "./orders";
```

- [ ] **Step 5: Gerar e aplicar a migração**

```bash
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:migrate:test
```

Expected: migração `0001_*.sql` criada e aplicada nos dois bancos sem erro.

- [ ] **Step 6: Conferir que as tabelas existem**

Run: `docker exec zepneu-postgres psql -U postgres -d zepneu -c "\dt"`
Expected: as 13 tabelas aparecem (5 do catálogo + 8 novas).

- [ ] **Step 7: Commit**

```bash
git add src/db drizzle
git commit -m "feat(db): schema de estoque, carrinho e pedido"
```

---

### Task 2: Máquina de estados do pedido

Domínio puro, sem banco. É o contrato que impede um pedido cancelado voltar a "pago".

**Files:**
- Create: `src/core/orders/order-status.ts`
- Test: `src/core/orders/order-status.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `err` (Plano 1)
- Produces:
  - `type OrderStatus = "aguardando_pagamento" | "pago" | "em_separacao" | "enviado" | "pronto_para_retirada" | "entregue" | "retirado" | "cancelado" | "estornado"`
  - `transicoesValidas: Record<OrderStatus, OrderStatus[]>`
  - `podeTransicionar(de: OrderStatus, para: OrderStatus): boolean`
  - `transicionar(de: OrderStatus, para: OrderStatus): Result<OrderStatus>`
  - `ROTULO_STATUS: Record<OrderStatus, string>`
  - `eFinal(status: OrderStatus): boolean`

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/core/orders/order-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  podeTransicionar,
  transicionar,
  transicoesValidas,
  eFinal,
  ROTULO_STATUS,
  type OrderStatus,
} from "./order-status";

describe("podeTransicionar", () => {
  it("permite o caminho feliz de entrega", () => {
    expect(podeTransicionar("aguardando_pagamento", "pago")).toBe(true);
    expect(podeTransicionar("pago", "em_separacao")).toBe(true);
    expect(podeTransicionar("em_separacao", "enviado")).toBe(true);
    expect(podeTransicionar("enviado", "entregue")).toBe(true);
  });

  it("permite o caminho de retirada", () => {
    expect(podeTransicionar("em_separacao", "pronto_para_retirada")).toBe(true);
    expect(podeTransicionar("pronto_para_retirada", "retirado")).toBe(true);
  });

  it("permite cancelar enquanto não foi pago", () => {
    expect(podeTransicionar("aguardando_pagamento", "cancelado")).toBe(true);
  });

  it("permite estornar depois de pago", () => {
    expect(podeTransicionar("pago", "estornado")).toBe(true);
  });

  it("proíbe pular o pagamento", () => {
    expect(podeTransicionar("aguardando_pagamento", "enviado")).toBe(false);
    expect(podeTransicionar("aguardando_pagamento", "entregue")).toBe(false);
  });

  it("proíbe ressuscitar pedido cancelado", () => {
    expect(podeTransicionar("cancelado", "pago")).toBe(false);
    expect(podeTransicionar("cancelado", "aguardando_pagamento")).toBe(false);
  });

  it("proíbe voltar atrás", () => {
    expect(podeTransicionar("entregue", "enviado")).toBe(false);
    expect(podeTransicionar("pago", "aguardando_pagamento")).toBe(false);
  });

  it("proíbe misturar entrega com retirada", () => {
    expect(podeTransicionar("enviado", "retirado")).toBe(false);
    expect(podeTransicionar("pronto_para_retirada", "entregue")).toBe(false);
  });
});

describe("transicionar", () => {
  it("devolve o novo status quando a transição é válida", () => {
    const r = transicionar("aguardando_pagamento", "pago");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("pago");
  });

  it("explica o motivo quando é inválida", () => {
    const r = transicionar("cancelado", "pago");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("cancelado");
      expect(r.error).toContain("pago");
    }
  });
});

describe("eFinal", () => {
  it("reconhece os estados de onde não se sai", () => {
    for (const s of ["entregue", "retirado", "cancelado", "estornado"] as const) {
      expect(eFinal(s), s).toBe(true);
    }
  });

  it("não marca estados intermediários como finais", () => {
    for (const s of ["aguardando_pagamento", "pago", "em_separacao"] as const) {
      expect(eFinal(s), s).toBe(false);
    }
  });
});

describe("rótulos", () => {
  it("tem rótulo em português para todo status", () => {
    for (const status of Object.keys(transicoesValidas) as OrderStatus[]) {
      expect(ROTULO_STATUS[status], status).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- order-status`
Expected: FAIL — `Failed to resolve import "./order-status"`.

- [ ] **Step 3: Implementar**

Criar `src/core/orders/order-status.ts`:

```ts
import { type Result, ok, err } from "@/core/shared/result";

export type OrderStatus =
  | "aguardando_pagamento"
  | "pago"
  | "em_separacao"
  | "enviado"
  | "pronto_para_retirada"
  | "entregue"
  | "retirado"
  | "cancelado"
  | "estornado";

/**
 * Único lugar onde as transições são declaradas.
 *
 * Entrega e retirada são caminhos separados de propósito: um pedido enviado
 * pelos Correios não pode virar "retirado", e um pedido separado para retirada
 * não pode virar "entregue". Misturar os dois faria o rastreio mentir.
 */
export const transicoesValidas: Record<OrderStatus, OrderStatus[]> = {
  aguardando_pagamento: ["pago", "cancelado"],
  pago: ["em_separacao", "cancelado", "estornado"],
  em_separacao: ["enviado", "pronto_para_retirada", "cancelado", "estornado"],
  enviado: ["entregue", "estornado"],
  pronto_para_retirada: ["retirado", "estornado"],
  entregue: [],
  retirado: [],
  cancelado: [],
  estornado: [],
};

export const ROTULO_STATUS: Record<OrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  em_separacao: "Em separação",
  enviado: "Enviado",
  pronto_para_retirada: "Pronto para retirada",
  entregue: "Entregue",
  retirado: "Retirado",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

export function podeTransicionar(de: OrderStatus, para: OrderStatus): boolean {
  return transicoesValidas[de].includes(para);
}

export function transicionar(
  de: OrderStatus,
  para: OrderStatus,
): Result<OrderStatus> {
  if (!podeTransicionar(de, para)) {
    return err(
      `Transição inválida: pedido "${ROTULO_STATUS[de]}" não pode ir para "${ROTULO_STATUS[para]}"`,
    );
  }
  return ok(para);
}

export function eFinal(status: OrderStatus): boolean {
  return transicoesValidas[status].length === 0;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- order-status`
Expected: PASS — 12 testes.

- [ ] **Step 5: Commit**

```bash
git add src/core/orders
git commit -m "feat(pedido): maquina de estados com transicoes declaradas em um lugar so"
```

---

### Task 3: Porta de estoque e tipos

**Files:**
- Create: `src/core/stock/types.ts`, `src/core/stock/stock-repository.ts`

**Interfaces:**
- Consumes: `Result` (Plano 1)
- Produces:
  - `type MovementKind = "entrada" | "reserva" | "liberacao" | "baixa" | "estorno" | "ajuste"`
  - `type Disponibilidade = { variantId: string; onHand: number; reserved: number; disponivel: number }`
  - `type PedidoDeReserva = { variantId: string; quantity: number }`
  - `interface StockRepository` com `disponibilidadeDe`, `registrarEntrada`, `reservar`, `liberarReserva`, `consumirReserva`, `ajustar`, `extrato`

- [ ] **Step 1: Escrever os tipos**

Criar `src/core/stock/types.ts`:

```ts
export type MovementKind =
  | "entrada"
  | "reserva"
  | "liberacao"
  | "baixa"
  | "estorno"
  | "ajuste";

export type Disponibilidade = {
  variantId: string;
  onHand: number;
  reserved: number;
  /** onHand - reserved. É este número que o cliente pode comprar. */
  disponivel: number;
};

export type PedidoDeReserva = {
  variantId: string;
  quantity: number;
};

export type Movimento = {
  id: string;
  kind: MovementKind;
  quantity: number;
  reason: string | null;
  orderRef: string | null;
  authorId: string | null;
  createdAt: Date;
};

export type FalhaDeEstoque =
  | { tipo: "indisponivel"; variantId: string; pedido: number; disponivel: number }
  | { tipo: "sku_sem_estoque"; variantId: string }
  | { tipo: "reserva_inexistente"; orderRef: string };
```

- [ ] **Step 2: Escrever a porta**

Criar `src/core/stock/stock-repository.ts`:

```ts
import type { Result } from "@/core/shared/result";
import type {
  Disponibilidade,
  FalhaDeEstoque,
  Movimento,
  PedidoDeReserva,
} from "./types";

/**
 * Porta do livro-razão de estoque.
 *
 * `reservar` recebe a lista inteira do carrinho de propósito: ou o pedido
 * inteiro é reservado, ou nada é. Reservar item a item deixaria o cliente com
 * meio pedido pago quando o último item faltasse.
 */
export interface StockRepository {
  disponibilidadeDe(variantIds: string[]): Promise<Disponibilidade[]>;

  registrarEntrada(args: {
    variantId: string;
    quantity: number;
    reason: string;
    authorId: string;
  }): Promise<void>;

  reservar(args: {
    orderRef: string;
    itens: PedidoDeReserva[];
    expiresAt: Date;
  }): Promise<Result<void, FalhaDeEstoque>>;

  liberarReserva(orderRef: string): Promise<void>;

  consumirReserva(orderRef: string): Promise<Result<void, FalhaDeEstoque>>;

  ajustar(args: {
    variantId: string;
    delta: number;
    reason: string;
    authorId: string;
  }): Promise<void>;

  extrato(variantId: string): Promise<Movimento[]>;

  /** Libera reservas vencidas. Devolve quantas liberou. */
  liberarVencidas(agora: Date): Promise<number>;
}
```

- [ ] **Step 3: Verificar que o núcleo continua puro**

Run: `npx eslint && npx tsc --noEmit`
Expected: PASS nos dois.

- [ ] **Step 4: Commit**

```bash
git add src/core/stock
git commit -m "feat(estoque): porta do livro-razao e tipos de disponibilidade"
```

---

### Task 4: Adaptador Drizzle do estoque — a tarefa central do plano

Aqui mora a regra que sustenta o projeto. O teste de concorrência não é opcional: sem ele, o desenho da seção 2.2 da spec é decorativo.

**Files:**
- Create: `src/db/repositories/drizzle-stock-repository.ts`
- Modify: `tests/helpers/db.ts`
- Test: `tests/integration/drizzle-stock-repository.test.ts`

**Interfaces:**
- Consumes: `StockRepository` (Task 3), schema de estoque (Task 1)
- Produces: `createDrizzleStockRepository(db: Database, locationId: string): StockRepository`; `semearEstoque(variantId, quantidade)` no helper de teste

- [ ] **Step 1: Estender o helper de teste**

Adicionar ao final de `tests/helpers/db.ts`:

```ts
export async function limparEstoqueEPedidos() {
  await testDb.execute(
    sql`TRUNCATE order_events, order_items, orders, cart_items, carts, stock_reservations, stock_movements, stock_balances RESTART IDENTITY CASCADE`,
  );
}

export async function criarLocal() {
  const [existente] = await testDb
    .select()
    .from(schema.stockLocations)
    .where(eq(schema.stockLocations.slug, "brasilia"))
    .limit(1);
  if (existente) return existente;

  const [criado] = await testDb
    .insert(schema.stockLocations)
    .values({ name: "Brasília", slug: "brasilia", city: "Brasília" })
    .returning();
  return criado;
}
```

O helper usa `eq`: somar `eq` ao import existente de `drizzle-orm` no topo do arquivo (`sql` já está lá).

- [ ] **Step 2: Escrever o teste de integração falhando**

Criar `tests/integration/drizzle-stock-repository.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  testDb,
  limparBanco,
  limparEstoqueEPedidos,
  semearCatalogo,
  criarLocal,
} from "../helpers/db";
import * as schema from "@/db/schema";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";

let repo: ReturnType<typeof createDrizzleStockRepository>;
let variantId: string;
let localId: string;

beforeEach(async () => {
  await limparEstoqueEPedidos();
  await limparBanco();
  await semearCatalogo();

  const local = await criarLocal();
  localId = local.id;
  repo = createDrizzleStockRepository(testDb, localId);

  const [v] = await testDb
    .select({ id: schema.productVariants.id })
    .from(schema.productVariants)
    .where(eq(schema.productVariants.sku, "MICH-PRIM4-2055516"));
  variantId = v.id;
});

describe("entrada e disponibilidade", () => {
  it("SKU sem movimento tem disponibilidade zero", async () => {
    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(0);
    expect(d.disponivel).toBe(0);
  });

  it("entrada aumenta o saldo e grava movimento", async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 10,
      reason: "Compra nota 123",
      authorId: "admin",
    });

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(10);
    expect(d.disponivel).toBe(10);

    const extrato = await repo.extrato(variantId);
    expect(extrato).toHaveLength(1);
    expect(extrato[0].kind).toBe("entrada");
    expect(extrato[0].quantity).toBe(10);
    expect(extrato[0].reason).toBe("Compra nota 123");
  });
});

describe("reserva", () => {
  beforeEach(async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 3,
      reason: "estoque inicial",
      authorId: "admin",
    });
  });

  it("reserva reduz o disponível sem reduzir o físico", async () => {
    const r = await repo.reservar({
      orderRef: crypto.randomUUID(),
      itens: [{ variantId, quantity: 2 }],
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(r.ok).toBe(true);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(3);
    expect(d.reserved).toBe(2);
    expect(d.disponivel).toBe(1);
  });

  it("recusa reserva acima do disponível e diz o que tem", async () => {
    const r = await repo.reservar({
      orderRef: crypto.randomUUID(),
      itens: [{ variantId, quantity: 4 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tipo).toBe("indisponivel");
    if (r.error.tipo !== "indisponivel") return;
    expect(r.error.pedido).toBe(4);
    expect(r.error.disponivel).toBe(3);
  });

  it("não reserva nada quando um item do pedido falta", async () => {
    const [outra] = await testDb
      .select({ id: schema.productVariants.id })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.sku, "PIRE-P7-2055516"));

    const r = await repo.reservar({
      orderRef: crypto.randomUUID(),
      itens: [
        { variantId, quantity: 1 },
        { variantId: outra.id, quantity: 1 },
      ],
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(r.ok).toBe(false);

    // O primeiro item não pode ter ficado reservado.
    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.reserved).toBe(0);
    expect(d.disponivel).toBe(3);
  });

  it("consumir a reserva baixa o físico", async () => {
    const orderRef = crypto.randomUUID();
    await repo.reservar({
      orderRef,
      itens: [{ variantId, quantity: 2 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const r = await repo.consumirReserva(orderRef);
    expect(r.ok).toBe(true);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(1);
    expect(d.reserved).toBe(0);
    expect(d.disponivel).toBe(1);
  });

  it("liberar a reserva devolve o disponível", async () => {
    const orderRef = crypto.randomUUID();
    await repo.reservar({
      orderRef,
      itens: [{ variantId, quantity: 2 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    await repo.liberarReserva(orderRef);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(3);
    expect(d.reserved).toBe(0);
    expect(d.disponivel).toBe(3);
  });

  it("libera reservas vencidas e não toca nas vivas", async () => {
    const vencida = crypto.randomUUID();
    const viva = crypto.randomUUID();

    await repo.reservar({
      orderRef: vencida,
      itens: [{ variantId, quantity: 1 }],
      expiresAt: new Date(Date.now() - 1000),
    });
    await repo.reservar({
      orderRef: viva,
      itens: [{ variantId, quantity: 1 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const liberadas = await repo.liberarVencidas(new Date());
    expect(liberadas).toBe(1);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.reserved).toBe(1);
    expect(d.disponivel).toBe(2);
  });
});

describe("concorrência", () => {
  /**
   * O teste que dá sentido a todo o desenho de estoque.
   *
   * Duas pessoas tentam levar o último pneu no mesmo instante. Exatamente uma
   * pode ganhar. Se as duas passarem, a loja vendeu o que não tem — e essa é a
   * falha mais cara possível numa operação nova.
   */
  it("duas reservas simultâneas do último item: uma passa, a outra falha", async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 1,
      reason: "último da prateleira",
      authorId: "admin",
    });

    const expiresAt = new Date(Date.now() + 60_000);
    const [a, b] = await Promise.all([
      repo.reservar({
        orderRef: crypto.randomUUID(),
        itens: [{ variantId, quantity: 1 }],
        expiresAt,
      }),
      repo.reservar({
        orderRef: crypto.randomUUID(),
        itens: [{ variantId, quantity: 1 }],
        expiresAt,
      }),
    ]);

    const vitoriosas = [a, b].filter((r) => r.ok).length;
    expect(vitoriosas).toBe(1);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.reserved).toBe(1);
    expect(d.disponivel).toBe(0);
  });

  it("dez reservas simultâneas de três unidades: exatamente três passam", async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 3,
      reason: "estoque inicial",
      authorId: "admin",
    });

    const expiresAt = new Date(Date.now() + 60_000);
    const resultados = await Promise.all(
      Array.from({ length: 10 }, () =>
        repo.reservar({
          orderRef: crypto.randomUUID(),
          itens: [{ variantId, quantity: 1 }],
          expiresAt,
        }),
      ),
    );

    expect(resultados.filter((r) => r.ok)).toHaveLength(3);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.reserved).toBe(3);
    expect(d.disponivel).toBe(0);
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- drizzle-stock-repository`
Expected: FAIL — módulo do adaptador não encontrado.

- [ ] **Step 4: Implementar o adaptador**

Criar `src/db/repositories/drizzle-stock-repository.ts`:

```ts
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  stockBalances,
  stockMovements,
  stockReservations,
} from "@/db/schema";
import type { StockRepository } from "@/core/stock/stock-repository";
import type {
  Disponibilidade,
  FalhaDeEstoque,
  Movimento,
  PedidoDeReserva,
} from "@/core/stock/types";
import { type Result, ok, err } from "@/core/shared/result";

export function createDrizzleStockRepository(
  db: Database,
  locationId: string,
): StockRepository {
  return {
    async disponibilidadeDe(variantIds: string[]): Promise<Disponibilidade[]> {
      if (variantIds.length === 0) return [];

      const linhas = await db
        .select({
          variantId: stockBalances.variantId,
          onHand: stockBalances.onHand,
          reserved: stockBalances.reserved,
        })
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.locationId, locationId),
            inArray(stockBalances.variantId, variantIds),
          ),
        );

      const porId = new Map(linhas.map((l) => [l.variantId, l]));

      // SKU sem linha de saldo nunca teve movimento: disponibilidade zero, e
      // não "ausente". Quem consome não deve precisar tratar o caso faltante.
      return variantIds.map((variantId) => {
        const l = porId.get(variantId);
        const onHand = l?.onHand ?? 0;
        const reserved = l?.reserved ?? 0;
        return { variantId, onHand, reserved, disponivel: onHand - reserved };
      });
    },

    async registrarEntrada({ variantId, quantity, reason, authorId }) {
      await db.transaction(async (tx) => {
        await tx
          .insert(stockBalances)
          .values({ variantId, locationId, onHand: quantity, reserved: 0 })
          .onConflictDoUpdate({
            target: [stockBalances.variantId, stockBalances.locationId],
            set: {
              onHand: sql`${stockBalances.onHand} + ${quantity}`,
              updatedAt: new Date(),
            },
          });

        await tx.insert(stockMovements).values({
          variantId,
          locationId,
          kind: "entrada",
          quantity,
          reason,
          authorId,
        });
      });
    },

    /**
     * Ou reserva o pedido inteiro, ou não reserva nada.
     *
     * As linhas de saldo são travadas com SELECT ... FOR UPDATE em ordem
     * determinística (por variantId). Sem a ordem fixa, dois pedidos com os
     * mesmos SKUs em ordem inversa se travariam mutuamente (deadlock).
     */
    async reservar({ orderRef, itens, expiresAt }): Promise<
      Result<void, FalhaDeEstoque>
    > {
      const ordenados = [...itens].sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      );

      try {
        return await db.transaction(async (tx) => {
          for (const item of ordenados) {
            const travadas = await tx
              .select({
                onHand: stockBalances.onHand,
                reserved: stockBalances.reserved,
              })
              .from(stockBalances)
              .where(
                and(
                  eq(stockBalances.variantId, item.variantId),
                  eq(stockBalances.locationId, locationId),
                ),
              )
              .for("update");

            const saldo = travadas[0];
            const disponivel = saldo ? saldo.onHand - saldo.reserved : 0;

            if (!saldo) {
              tx.rollback();
              return err<FalhaDeEstoque>({
                tipo: "sku_sem_estoque",
                variantId: item.variantId,
              });
            }

            if (disponivel < item.quantity) {
              tx.rollback();
              return err<FalhaDeEstoque>({
                tipo: "indisponivel",
                variantId: item.variantId,
                pedido: item.quantity,
                disponivel,
              });
            }
          }

          for (const item of ordenados) {
            await tx
              .update(stockBalances)
              .set({
                reserved: sql`${stockBalances.reserved} + ${item.quantity}`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(stockBalances.variantId, item.variantId),
                  eq(stockBalances.locationId, locationId),
                ),
              );

            await tx.insert(stockMovements).values({
              variantId: item.variantId,
              locationId,
              kind: "reserva",
              quantity: item.quantity,
              orderRef,
            });

            await tx.insert(stockReservations).values({
              variantId: item.variantId,
              locationId,
              orderRef,
              quantity: item.quantity,
              expiresAt,
            });
          }

          return ok(undefined);
        });
      } catch (e) {
        // tx.rollback() do Drizzle lança para desfazer; a falha já foi
        // decidida acima, então recuperamos o motivo relendo o saldo.
        if (e instanceof Error && e.message.includes("Rollback")) {
          const atuais = await this.disponibilidadeDe(
            ordenados.map((i) => i.variantId),
          );
          const faltante = ordenados.find((i) => {
            const d = atuais.find((a) => a.variantId === i.variantId);
            return !d || d.disponivel < i.quantity;
          });
          const d = atuais.find((a) => a.variantId === faltante?.variantId);
          return err<FalhaDeEstoque>({
            tipo: "indisponivel",
            variantId: faltante?.variantId ?? ordenados[0].variantId,
            pedido: faltante?.quantity ?? 0,
            disponivel: d?.disponivel ?? 0,
          });
        }
        throw e;
      }
    },

    async liberarReserva(orderRef: string) {
      await db.transaction(async (tx) => {
        const reservas = await tx
          .select()
          .from(stockReservations)
          .where(
            and(
              eq(stockReservations.orderRef, orderRef),
              eq(stockReservations.status, "ativa"),
            ),
          );

        for (const r of reservas) {
          await tx
            .update(stockBalances)
            .set({
              reserved: sql`${stockBalances.reserved} - ${r.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(stockBalances.variantId, r.variantId),
                eq(stockBalances.locationId, r.locationId),
              ),
            );

          await tx.insert(stockMovements).values({
            variantId: r.variantId,
            locationId: r.locationId,
            kind: "liberacao",
            quantity: r.quantity,
            orderRef,
          });
        }

        if (reservas.length > 0) {
          await tx
            .update(stockReservations)
            .set({ status: "liberada" })
            .where(
              and(
                eq(stockReservations.orderRef, orderRef),
                eq(stockReservations.status, "ativa"),
              ),
            );
        }
      });
    },

    async consumirReserva(orderRef: string): Promise<Result<void, FalhaDeEstoque>> {
      const consumidas = await db.transaction(async (tx) => {
        const reservas = await tx
          .select()
          .from(stockReservations)
          .where(
            and(
              eq(stockReservations.orderRef, orderRef),
              eq(stockReservations.status, "ativa"),
            ),
          );

        for (const r of reservas) {
          await tx
            .update(stockBalances)
            .set({
              onHand: sql`${stockBalances.onHand} - ${r.quantity}`,
              reserved: sql`${stockBalances.reserved} - ${r.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(stockBalances.variantId, r.variantId),
                eq(stockBalances.locationId, r.locationId),
              ),
            );

          await tx.insert(stockMovements).values({
            variantId: r.variantId,
            locationId: r.locationId,
            kind: "baixa",
            quantity: r.quantity,
            orderRef,
          });
        }

        if (reservas.length > 0) {
          await tx
            .update(stockReservations)
            .set({ status: "consumida" })
            .where(
              and(
                eq(stockReservations.orderRef, orderRef),
                eq(stockReservations.status, "ativa"),
              ),
            );
        }

        return reservas.length;
      });

      if (consumidas === 0) {
        return err<FalhaDeEstoque>({ tipo: "reserva_inexistente", orderRef });
      }
      return ok(undefined);
    },

    async ajustar({ variantId, delta, reason, authorId }) {
      await db.transaction(async (tx) => {
        await tx
          .insert(stockBalances)
          .values({ variantId, locationId, onHand: delta, reserved: 0 })
          .onConflictDoUpdate({
            target: [stockBalances.variantId, stockBalances.locationId],
            set: {
              onHand: sql`${stockBalances.onHand} + ${delta}`,
              updatedAt: new Date(),
            },
          });

        await tx.insert(stockMovements).values({
          variantId,
          locationId,
          kind: "ajuste",
          quantity: delta,
          reason,
          authorId,
        });
      });
    },

    async extrato(variantId: string): Promise<Movimento[]> {
      const linhas = await db
        .select({
          id: stockMovements.id,
          kind: stockMovements.kind,
          quantity: stockMovements.quantity,
          reason: stockMovements.reason,
          orderRef: stockMovements.orderRef,
          authorId: stockMovements.authorId,
          createdAt: stockMovements.createdAt,
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.variantId, variantId),
            eq(stockMovements.locationId, locationId),
          ),
        )
        .orderBy(stockMovements.createdAt);

      return linhas;
    },

    async liberarVencidas(agora: Date): Promise<number> {
      const vencidas = await db
        .select({ orderRef: stockReservations.orderRef })
        .from(stockReservations)
        .where(
          and(
            eq(stockReservations.status, "ativa"),
            lte(stockReservations.expiresAt, agora),
          ),
        );

      const pedidos = [...new Set(vencidas.map((v) => v.orderRef))];
      for (const ref of pedidos) {
        await this.liberarReserva(ref);
      }
      return pedidos.length;
    },
  };
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- drizzle-stock-repository`
Expected: PASS — 10 testes, **incluindo os dois de concorrência**.

Se algum teste de concorrência falhar com mais de um vencedor, a trava não está segurando: conferir se `.for("update")` está presente e se o Postgres do teste não é um mock.

- [ ] **Step 6: Rodar a suíte inteira e o lint**

Run: `npm test && npx eslint`
Expected: PASS nos dois.

- [ ] **Step 7: Commit**

```bash
git add src/db tests
git commit -m "feat(estoque): livro-razao com trava de linha e reserva tudo-ou-nada"
```

---

### Task 5: Cálculo do carrinho

**Files:**
- Create: `src/core/cart/types.ts`, `src/core/cart/cart-totals.ts`
- Test: `src/core/cart/cart-totals.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type CartItem = { variantId: string; sku: string; productName: string; productSlug: string; sizeLabel: string | null; unitPriceCents: number; quantity: number; disponivel: number }`
  - `type CartTotals = { itemsTotalCents: number; quantidadeTotal: number; temItemIndisponivel: boolean }`
  - `calcularTotais(itens: CartItem[]): CartTotals`
  - `LIMITE_POR_ITEM = 20`
  - `normalizarQuantidade(pedida: number, disponivel: number): number`

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/core/cart/cart-totals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  calcularTotais,
  normalizarQuantidade,
  LIMITE_POR_ITEM,
} from "./cart-totals";
import type { CartItem } from "./types";

function item(over: Partial<CartItem> = {}): CartItem {
  return {
    variantId: "v1",
    sku: "SKU-1",
    productName: "Primacy 4",
    productSlug: "michelin-primacy-4",
    sizeLabel: "205/55 R16 91V",
    unitPriceCents: 65000,
    quantity: 1,
    disponivel: 10,
    ...over,
  };
}

describe("calcularTotais", () => {
  it("carrinho vazio soma zero", () => {
    const t = calcularTotais([]);
    expect(t.itemsTotalCents).toBe(0);
    expect(t.quantidadeTotal).toBe(0);
    expect(t.temItemIndisponivel).toBe(false);
  });

  it("multiplica preço por quantidade", () => {
    const t = calcularTotais([item({ quantity: 4 })]);
    expect(t.itemsTotalCents).toBe(260000);
    expect(t.quantidadeTotal).toBe(4);
  });

  it("soma itens diferentes", () => {
    const t = calcularTotais([
      item({ variantId: "v1", quantity: 2, unitPriceCents: 65000 }),
      item({ variantId: "v2", quantity: 1, unitPriceCents: 58000 }),
    ]);
    expect(t.itemsTotalCents).toBe(188000);
    expect(t.quantidadeTotal).toBe(3);
  });

  it("aponta quando algum item passou do estoque", () => {
    const t = calcularTotais([item({ quantity: 5, disponivel: 2 })]);
    expect(t.temItemIndisponivel).toBe(true);
  });

  it("não aponta indisponível quando tudo cabe", () => {
    const t = calcularTotais([item({ quantity: 2, disponivel: 2 })]);
    expect(t.temItemIndisponivel).toBe(false);
  });
});

describe("normalizarQuantidade", () => {
  it("mantém quantidade válida", () => {
    expect(normalizarQuantidade(3, 10)).toBe(3);
  });

  it("corta no estoque disponível", () => {
    expect(normalizarQuantidade(9, 4)).toBe(4);
  });

  it("corta no limite por item", () => {
    expect(normalizarQuantidade(999, 500)).toBe(LIMITE_POR_ITEM);
  });

  it("nunca devolve menos que zero", () => {
    expect(normalizarQuantidade(-5, 10)).toBe(0);
    expect(normalizarQuantidade(3, 0)).toBe(0);
  });

  it("arredonda fração para baixo", () => {
    expect(normalizarQuantidade(2.7, 10)).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- cart-totals`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `src/core/cart/types.ts`:

```ts
export type CartItem = {
  variantId: string;
  sku: string;
  productName: string;
  productSlug: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  /** Estoque disponível agora, para avisar antes do checkout. */
  disponivel: number;
};

export type Cart = {
  id: string;
  token: string;
  itens: CartItem[];
};

export type CartTotals = {
  itemsTotalCents: number;
  quantidadeTotal: number;
  temItemIndisponivel: boolean;
};
```

Criar `src/core/cart/cart-totals.ts`:

```ts
import type { CartItem, CartTotals } from "./types";

/** Trava contra erro de digitação e contra revenda disfarçada de varejo. */
export const LIMITE_POR_ITEM = 20;

export function calcularTotais(itens: CartItem[]): CartTotals {
  let itemsTotalCents = 0;
  let quantidadeTotal = 0;
  let temItemIndisponivel = false;

  for (const item of itens) {
    itemsTotalCents += item.unitPriceCents * item.quantity;
    quantidadeTotal += item.quantity;
    if (item.quantity > item.disponivel) temItemIndisponivel = true;
  }

  return { itemsTotalCents, quantidadeTotal, temItemIndisponivel };
}

/**
 * Quantidade que o carrinho realmente aceita.
 *
 * Corta no estoque e no limite por item em vez de rejeitar: o cliente que pede
 * 9 e só tem 4 prefere levar 4 a receber um erro e recomeçar.
 */
export function normalizarQuantidade(
  pedida: number,
  disponivel: number,
): number {
  const inteira = Math.floor(pedida);
  if (!Number.isFinite(inteira) || inteira < 0) return 0;
  return Math.max(0, Math.min(inteira, disponivel, LIMITE_POR_ITEM));
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- cart-totals`
Expected: PASS — 10 testes.

- [ ] **Step 5: Commit**

```bash
git add src/core/cart
git commit -m "feat(carrinho): calculo de totais e normalizacao de quantidade"
```

---

### Task 6: Porta e adaptador do carrinho

**Files:**
- Create: `src/core/cart/cart-repository.ts`
- Create: `src/db/repositories/drizzle-cart-repository.ts`
- Test: `tests/integration/drizzle-cart-repository.test.ts`

**Interfaces:**
- Consumes: `Cart`, `CartItem` (Task 5), `StockRepository` (Task 3), schema de carrinho (Task 1)
- Produces:
  - `interface CartRepository { obterOuCriar(token): Promise<Cart>; definirItem(token, variantId, quantity): Promise<Cart>; remover(token, variantId): Promise<Cart>; limpar(token): Promise<void> }`
  - `createDrizzleCartRepository(db: Database, estoque: StockRepository): CartRepository`

- [ ] **Step 1: Escrever a porta**

Criar `src/core/cart/cart-repository.ts`:

```ts
import type { Cart } from "./types";

export interface CartRepository {
  obterOuCriar(token: string): Promise<Cart>;
  /** Define a quantidade absoluta do SKU. Zero remove o item. */
  definirItem(
    token: string,
    variantId: string,
    quantity: number,
  ): Promise<Cart>;
  remover(token: string, variantId: string): Promise<Cart>;
  limpar(token: string): Promise<void>;
}
```

- [ ] **Step 2: Escrever o teste de integração falhando**

Criar `tests/integration/drizzle-cart-repository.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  testDb,
  limparBanco,
  limparEstoqueEPedidos,
  semearCatalogo,
  criarLocal,
} from "../helpers/db";
import * as schema from "@/db/schema";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";
import { createDrizzleCartRepository } from "@/db/repositories/drizzle-cart-repository";

const TOKEN = "token-de-teste";
let repo: ReturnType<typeof createDrizzleCartRepository>;
let variantId: string;

beforeEach(async () => {
  await limparEstoqueEPedidos();
  await limparBanco();
  await semearCatalogo();

  const local = await criarLocal();
  const estoque = createDrizzleStockRepository(testDb, local.id);
  repo = createDrizzleCartRepository(testDb, estoque);

  const [v] = await testDb
    .select({ id: schema.productVariants.id })
    .from(schema.productVariants)
    .where(eq(schema.productVariants.sku, "MICH-PRIM4-2055516"));
  variantId = v.id;

  await estoque.registrarEntrada({
    variantId,
    quantity: 5,
    reason: "estoque inicial",
    authorId: "admin",
  });
});

describe("obterOuCriar", () => {
  it("cria carrinho vazio na primeira visita", async () => {
    const c = await repo.obterOuCriar(TOKEN);
    expect(c.token).toBe(TOKEN);
    expect(c.itens).toEqual([]);
  });

  it("devolve o mesmo carrinho na segunda visita", async () => {
    const a = await repo.obterOuCriar(TOKEN);
    const b = await repo.obterOuCriar(TOKEN);
    expect(b.id).toBe(a.id);
  });
});

describe("definirItem", () => {
  it("adiciona item com dados do produto e disponibilidade", async () => {
    const c = await repo.definirItem(TOKEN, variantId, 2);

    expect(c.itens).toHaveLength(1);
    expect(c.itens[0].quantity).toBe(2);
    expect(c.itens[0].sku).toBe("MICH-PRIM4-2055516");
    expect(c.itens[0].productName).toBe("Primacy 4");
    expect(c.itens[0].sizeLabel).toBe("205/55 R16 91V");
    expect(c.itens[0].unitPriceCents).toBe(65000);
    expect(c.itens[0].disponivel).toBe(5);
  });

  it("define quantidade absoluta, não incrementa", async () => {
    await repo.definirItem(TOKEN, variantId, 2);
    const c = await repo.definirItem(TOKEN, variantId, 3);
    expect(c.itens).toHaveLength(1);
    expect(c.itens[0].quantity).toBe(3);
  });

  it("corta a quantidade no estoque disponível", async () => {
    const c = await repo.definirItem(TOKEN, variantId, 99);
    expect(c.itens[0].quantity).toBe(5);
  });

  it("quantidade zero remove o item", async () => {
    await repo.definirItem(TOKEN, variantId, 2);
    const c = await repo.definirItem(TOKEN, variantId, 0);
    expect(c.itens).toEqual([]);
  });
});

describe("remover e limpar", () => {
  it("remove um item", async () => {
    await repo.definirItem(TOKEN, variantId, 2);
    const c = await repo.remover(TOKEN, variantId);
    expect(c.itens).toEqual([]);
  });

  it("limpa o carrinho inteiro", async () => {
    await repo.definirItem(TOKEN, variantId, 2);
    await repo.limpar(TOKEN);
    const c = await repo.obterOuCriar(TOKEN);
    expect(c.itens).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- drizzle-cart-repository`
Expected: FAIL — módulo do adaptador não encontrado.

- [ ] **Step 4: Implementar o adaptador**

Criar `src/db/repositories/drizzle-cart-repository.ts`:

```ts
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { carts, cartItems, productVariants, products } from "@/db/schema";
import type { CartRepository } from "@/core/cart/cart-repository";
import type { Cart, CartItem } from "@/core/cart/types";
import type { StockRepository } from "@/core/stock/stock-repository";
import { normalizarQuantidade } from "@/core/cart/cart-totals";
import { formatTireSize } from "@/core/catalog/tire-size";

export function createDrizzleCartRepository(
  db: Database,
  estoque: StockRepository,
): CartRepository {
  async function carrinhoDoToken(token: string) {
    const [existente] = await db
      .select()
      .from(carts)
      .where(eq(carts.token, token))
      .limit(1);
    if (existente) return existente;

    const [criado] = await db.insert(carts).values({ token }).returning();
    return criado;
  }

  async function montar(cartId: string, token: string): Promise<Cart> {
    const linhas = await db
      .select({
        variantId: cartItems.variantId,
        quantity: cartItems.quantity,
        sku: productVariants.sku,
        unitPriceCents: productVariants.priceCents,
        width: productVariants.width,
        profile: productVariants.profile,
        rim: productVariants.rim,
        loadIndex: productVariants.loadIndex,
        speedRating: productVariants.speedRating,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(cartItems.cartId, cartId));

    const disponibilidades = await estoque.disponibilidadeDe(
      linhas.map((l) => l.variantId),
    );
    const porId = new Map(disponibilidades.map((d) => [d.variantId, d]));

    const itens: CartItem[] = linhas.map((l) => ({
      variantId: l.variantId,
      sku: l.sku,
      productName: l.productName,
      productSlug: l.productSlug,
      sizeLabel:
        l.width !== null && l.profile !== null && l.rim !== null
          ? formatTireSize({
              width: l.width,
              profile: l.profile,
              rim: l.rim,
              loadIndex: l.loadIndex,
              speedRating: l.speedRating,
            })
          : null,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      disponivel: porId.get(l.variantId)?.disponivel ?? 0,
    }));

    itens.sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR"));
    return { id: cartId, token, itens };
  }

  return {
    async obterOuCriar(token: string): Promise<Cart> {
      const carrinho = await carrinhoDoToken(token);
      return montar(carrinho.id, token);
    },

    async definirItem(token, variantId, quantity): Promise<Cart> {
      const carrinho = await carrinhoDoToken(token);
      const [disponibilidade] = await estoque.disponibilidadeDe([variantId]);
      const final = normalizarQuantidade(quantity, disponibilidade.disponivel);

      if (final === 0) {
        await db
          .delete(cartItems)
          .where(
            and(
              eq(cartItems.cartId, carrinho.id),
              eq(cartItems.variantId, variantId),
            ),
          );
      } else {
        await db
          .insert(cartItems)
          .values({ cartId: carrinho.id, variantId, quantity: final })
          .onConflictDoUpdate({
            target: [cartItems.cartId, cartItems.variantId],
            set: { quantity: final },
          });
      }

      await db
        .update(carts)
        .set({ updatedAt: new Date() })
        .where(eq(carts.id, carrinho.id));

      return montar(carrinho.id, token);
    },

    async remover(token, variantId): Promise<Cart> {
      return this.definirItem(token, variantId, 0);
    },

    async limpar(token: string): Promise<void> {
      const carrinho = await carrinhoDoToken(token);
      await db.delete(cartItems).where(eq(cartItems.cartId, carrinho.id));
    },
  };
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- drizzle-cart-repository`
Expected: PASS — 8 testes.

- [ ] **Step 6: Commit**

```bash
git add src/core/cart src/db tests
git commit -m "feat(carrinho): porta e adaptador com corte pelo estoque disponivel"
```

---

### Task 7: Identidade do carrinho e Server Actions

**Files:**
- Create: `src/lib/cart-cookie.ts`
- Create: `src/app/(loja)/carrinho/acoes.ts`
- Modify: `src/lib/container.ts`

**Interfaces:**
- Consumes: `CartRepository` (Task 6), `StockRepository` (Task 3)
- Produces:
  - `tokenDoCarrinho(): Promise<string>`
  - `getCartRepository()`, `getStockRepository()` no container
  - Server Actions `definirItemDoCarrinho`, `removerDoCarrinho`

- [ ] **Step 1: Escrever a identidade do carrinho**

Criar `src/lib/cart-cookie.ts`:

```ts
import { cookies } from "next/headers";

const NOME = "ze_carrinho";
const UM_ANO = 60 * 60 * 24 * 365;

/**
 * Token do carrinho de visitante.
 *
 * Checkout sem cadastro é exigência da spec — pedir conta antes de comprar
 * derruba conversão. O cookie é httpOnly para que script de terceiro não
 * consiga ler nem trocar o carrinho de alguém.
 */
export async function tokenDoCarrinho(): Promise<string> {
  const jar = await cookies();
  const atual = jar.get(NOME)?.value;
  if (atual) return atual;

  const novo = crypto.randomUUID();
  jar.set(NOME, novo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UM_ANO,
    path: "/",
  });
  return novo;
}
```

- [ ] **Step 2: Ampliar o container**

Substituir `src/lib/container.ts`:

```ts
import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import { stockLocations } from "@/db/schema";
import { createDrizzleProductRepository } from "@/db/repositories/drizzle-product-repository";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";
import { createDrizzleCartRepository } from "@/db/repositories/drizzle-cart-repository";
import { createCatalogService } from "@/core/catalog/catalog-service";

/**
 * Ponto único onde o domínio é ligado à infraestrutura.
 *
 * As páginas e rotas pedem os serviços aqui em vez de construir repositórios,
 * então trocar a implementação de uma porta acontece num arquivo só.
 */
let catalogo: ReturnType<typeof createCatalogService> | null = null;

export function getCatalogService() {
  catalogo ??= createCatalogService(createDrizzleProductRepository(db));
  return catalogo;
}

// Na Fase 1 existe um único local de estoque. Resolvido uma vez e memorizado.
let localIdCache: string | null = null;

export async function getLocalPadraoId(): Promise<string> {
  if (localIdCache) return localIdCache;

  const [local] = await db
    .select({ id: stockLocations.id })
    .from(stockLocations)
    .where(eq(stockLocations.slug, "brasilia"))
    .limit(1);

  if (!local) {
    throw new Error(
      'Local de estoque "brasilia" não cadastrado. Rode o seed de estoque.',
    );
  }

  localIdCache = local.id;
  return local.id;
}

export async function getStockRepository() {
  return createDrizzleStockRepository(db, await getLocalPadraoId());
}

export async function getCartRepository() {
  return createDrizzleCartRepository(db, await getStockRepository());
}
```

- [ ] **Step 3: Escrever as Server Actions**

Criar `src/app/(loja)/carrinho/acoes.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCartRepository } from "@/lib/container";
import { tokenDoCarrinho } from "@/lib/cart-cookie";
import { LIMITE_POR_ITEM } from "@/core/cart/cart-totals";

const entrada = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).max(LIMITE_POR_ITEM),
});

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

export async function definirItemDoCarrinho(
  dados: FormData,
): Promise<ResultadoAcao> {
  const parsed = entrada.safeParse({
    variantId: dados.get("variantId"),
    quantity: dados.get("quantity"),
  });

  if (!parsed.success) {
    return { ok: false, erro: "Quantidade inválida." };
  }

  try {
    const carrinho = await getCartRepository();
    await carrinho.definirItem(
      await tokenDoCarrinho(),
      parsed.data.variantId,
      parsed.data.quantity,
    );
  } catch (erro) {
    console.error("Falha ao alterar o carrinho", erro);
    return { ok: false, erro: "Não foi possível atualizar o carrinho." };
  }

  revalidatePath("/carrinho");
  return { ok: true };
}

export async function removerDoCarrinho(
  dados: FormData,
): Promise<ResultadoAcao> {
  const variantId = String(dados.get("variantId") ?? "");
  if (!z.string().uuid().safeParse(variantId).success) {
    return { ok: false, erro: "Item inválido." };
  }

  try {
    const carrinho = await getCartRepository();
    await carrinho.remover(await tokenDoCarrinho(), variantId);
  } catch (erro) {
    console.error("Falha ao remover do carrinho", erro);
    return { ok: false, erro: "Não foi possível remover o item." };
  }

  revalidatePath("/carrinho");
  return { ok: true };
}
```

- [ ] **Step 4: Verificar tipos e lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: PASS nos dois.

- [ ] **Step 5: Commit**

```bash
git add src/lib "src/app/(loja)/carrinho"
git commit -m "feat(carrinho): cookie httpOnly de visitante e server actions"
```

---

### Task 8: Página do carrinho e botão de adicionar

**Files:**
- Create: `src/app/(loja)/carrinho/page.tsx`
- Create: `src/components/carrinho/linha-do-carrinho.tsx`
- Create: `src/components/produto/botao-adicionar.tsx`
- Create: `src/components/icones-carrinho.tsx`
- Modify: `src/components/produto/seletor-medida.tsx`
- Modify: `src/components/layout/cabecalho.tsx`

**Interfaces:**
- Consumes: Server Actions (Task 7), `calcularTotais` (Task 5), `formatBRL` (Plano 1)
- Produces: rota `/carrinho`; `BotaoAdicionar`; `IconeCarrinho`, `IconeLixeira`

- [ ] **Step 1: Escrever os ícones novos**

Criar `src/components/icones-carrinho.tsx`:

```tsx
type Props = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function IconeCarrinho({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 11.2a1 1 0 001 .8h9.2a1 1 0 001-.8L21 7H6" />
    </svg>
  );
}

export function IconeLixeira({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}
```

- [ ] **Step 2: Escrever o botão de adicionar**

Criar `src/components/produto/botao-adicionar.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { definirItemDoCarrinho } from "@/app/(loja)/carrinho/acoes";
import { IconeCarrinho } from "@/components/icones-carrinho";

export function BotaoAdicionar({
  variantId,
  disponivel,
}: {
  variantId: string;
  disponivel: number;
}) {
  const [quantidade, setQuantidade] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const esgotado = disponivel <= 0;

  function adicionar() {
    setErro(null);
    iniciar(async () => {
      const dados = new FormData();
      dados.set("variantId", variantId);
      dados.set("quantity", String(quantidade));

      const r = await definirItemDoCarrinho(dados);
      if (!r.ok) setErro(r.erro);
      else router.push("/carrinho");
    });
  }

  if (esgotado) {
    return (
      <p className="mt-8 border border-neutral-300 px-6 py-4 text-center text-sm font-bold uppercase tracking-wide text-tinta-media">
        Esgotado nesta medida
      </p>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex gap-3">
        <label className="sr-only" htmlFor="quantidade">
          Quantidade
        </label>
        <select
          id="quantidade"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          className="numerais-tabulares border border-neutral-300 px-4 py-4 font-bold text-tinta"
        >
          {Array.from({ length: Math.min(disponivel, 20) }, (_, i) => i + 1).map(
            (n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ),
          )}
        </select>

        <button
          type="button"
          onClick={adicionar}
          disabled={pendente}
          className="flex flex-1 items-center justify-center gap-2 bg-marca px-6 py-4 text-base font-bold uppercase tracking-wide text-white transition hover:bg-marca-escura disabled:opacity-60"
        >
          <IconeCarrinho className="h-5 w-5" />
          {pendente ? "Adicionando..." : "Adicionar ao carrinho"}
        </button>
      </div>

      {disponivel <= 3 && (
        <p className="mt-3 text-sm font-semibold text-marca">
          {disponivel === 1
            ? "Última unidade nesta medida"
            : `Restam apenas ${disponivel} unidades`}
        </p>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm font-semibold text-marca">
          {erro}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Ligar o botão ao seletor de medida**

Em `src/components/produto/seletor-medida.tsx`, trocar o bloco do botão desabilitado por `<BotaoAdicionar variantId={selecionada.id} disponivel={selecionada.disponivel} />`, adicionar o import e estender `VariantDetail` com `disponivel: number`.

Em `src/core/catalog/types.ts`, adicionar `disponivel: number;` ao tipo `VariantDetail`.

Em `src/db/repositories/drizzle-product-repository.ts`, no `findBySlug`, buscar a disponibilidade das variantes e preencher o campo. Como o repositório de catálogo não conhece estoque, o valor entra por `LEFT JOIN` direto em `stock_balances`:

```ts
// no topo
import { stockBalances } from "@/db/schema";

// dentro de findBySlug, substituindo a consulta de variantes:
const variantes = await db
  .select({
    id: productVariants.id,
    sku: productVariants.sku,
    priceCents: productVariants.priceCents,
    width: productVariants.width,
    profile: productVariants.profile,
    rim: productVariants.rim,
    loadIndex: productVariants.loadIndex,
    speedRating: productVariants.speedRating,
    vehicleType: productVariants.vehicleType,
    onHand: stockBalances.onHand,
    reserved: stockBalances.reserved,
  })
  .from(productVariants)
  .leftJoin(stockBalances, eq(stockBalances.variantId, productVariants.id))
  .where(
    and(
      eq(productVariants.productId, produto.id),
      eq(productVariants.status, "active"),
    ),
  );
```

E no retorno das variantes: `disponivel: Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)),`.

- [ ] **Step 4: Escrever a linha do carrinho**

Criar `src/components/carrinho/linha-do-carrinho.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CartItem } from "@/core/cart/types";
import { formatBRL } from "@/lib/format";
import { LIMITE_POR_ITEM } from "@/core/cart/cart-totals";
import {
  definirItemDoCarrinho,
  removerDoCarrinho,
} from "@/app/(loja)/carrinho/acoes";
import { IconeLixeira } from "@/components/icones-carrinho";

export function LinhaDoCarrinho({ item }: { item: CartItem }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function acao(fn: (d: FormData) => Promise<unknown>, quantity?: number) {
    iniciar(async () => {
      const dados = new FormData();
      dados.set("variantId", item.variantId);
      if (quantity !== undefined) dados.set("quantity", String(quantity));
      await fn(dados);
      router.refresh();
    });
  }

  const excedeu = item.quantity > item.disponivel;
  const maximo = Math.min(Math.max(item.disponivel, item.quantity), LIMITE_POR_ITEM);

  return (
    <li
      className={`flex flex-wrap items-center gap-4 border-t border-neutral-200 py-6 ${
        pendente ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-48 flex-1">
        <Link
          href={`/produto/${item.productSlug}`}
          className="font-bold text-tinta transition hover:text-marca"
        >
          {item.productName}
        </Link>
        {item.sizeLabel && (
          <p className="numerais-tabulares mt-1 text-sm text-tinta-media">
            {item.sizeLabel}
          </p>
        )}
        <p className="mt-1 text-xs text-tinta-media">{item.sku}</p>

        {excedeu && (
          <p role="alert" className="mt-2 text-sm font-semibold text-marca">
            {item.disponivel === 0
              ? "Este item esgotou"
              : `Só temos ${item.disponivel} em estoque`}
          </p>
        )}
      </div>

      <label className="sr-only" htmlFor={`qtd-${item.variantId}`}>
        Quantidade de {item.productName}
      </label>
      <select
        id={`qtd-${item.variantId}`}
        value={item.quantity}
        disabled={pendente || item.disponivel === 0}
        onChange={(e) =>
          acao(definirItemDoCarrinho, Number(e.target.value))
        }
        className="numerais-tabulares border border-neutral-300 px-3 py-2 font-bold text-tinta disabled:opacity-50"
      >
        {Array.from({ length: Math.max(maximo, 1) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <p className="numerais-tabulares w-32 text-right text-lg font-black text-tinta">
        {formatBRL(item.unitPriceCents * item.quantity)}
      </p>

      <button
        type="button"
        onClick={() => acao(removerDoCarrinho)}
        disabled={pendente}
        aria-label={`Remover ${item.productName} do carrinho`}
        className="p-2 text-tinta-media transition hover:text-marca"
      >
        <IconeLixeira className="h-5 w-5" />
      </button>
    </li>
  );
}
```

- [ ] **Step 5: Escrever a página do carrinho**

Criar `src/app/(loja)/carrinho/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getCartRepository } from "@/lib/container";
import { tokenDoCarrinho } from "@/lib/cart-cookie";
import { calcularTotais } from "@/core/cart/cart-totals";
import { formatBRL } from "@/lib/format";
import { LinhaDoCarrinho } from "@/components/carrinho/linha-do-carrinho";

export const metadata: Metadata = {
  title: "Carrinho",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CarrinhoPage() {
  const carrinho = await getCartRepository();
  const { itens } = await carrinho.obterOuCriar(await tokenDoCarrinho());
  const totais = calcularTotais(itens);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl font-black uppercase italic tracking-tight text-tinta">
        Carrinho
      </h1>

      {itens.length === 0 ? (
        <div className="mt-12 border border-dashed border-neutral-300 p-16 text-center">
          <p className="text-tinta-media">Seu carrinho está vazio.</p>
          <Link
            href="/pneus"
            className="mt-6 inline-block bg-marca px-8 py-4 text-base font-bold uppercase tracking-wide text-white transition hover:bg-marca-escura"
          >
            Ver pneus
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8">
            {itens.map((item) => (
              <LinhaDoCarrinho key={item.variantId} item={item} />
            ))}
          </ul>

          <div className="mt-8 border-t-4 border-tinta pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold uppercase tracking-widest text-tinta-media">
                Subtotal
              </span>
              <span className="numerais-tabulares text-3xl font-black text-tinta">
                {formatBRL(totais.itemsTotalCents)}
              </span>
            </div>
            <p className="mt-2 text-right text-sm text-tinta-media">
              Frete calculado na próxima etapa.
            </p>

            {totais.temItemIndisponivel && (
              <p
                role="alert"
                className="mt-6 border border-marca p-4 text-sm font-semibold text-marca"
              >
                Ajuste os itens marcados acima antes de continuar.
              </p>
            )}

            <button
              type="button"
              disabled
              title="O checkout entra na próxima etapa do projeto"
              className="mt-6 w-full bg-marca px-6 py-4 text-base font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
            >
              Finalizar compra
            </button>
          </div>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Somar o link do carrinho ao cabeçalho**

Em `src/components/layout/cabecalho.tsx`, adicionar antes do botão de WhatsApp:

```tsx
<Link
  href="/carrinho"
  aria-label="Ver carrinho"
  className="text-white transition hover:text-marca"
>
  <IconeCarrinho className="h-6 w-6" />
</Link>
```

com `import { IconeCarrinho } from "@/components/icones-carrinho";`.

- [ ] **Step 7: Verificar no navegador**

```bash
docker compose up -d
npm run dev
```

Percorrer: abrir um produto, escolher medida, adicionar ao carrinho, alterar a quantidade, remover, e confirmar o estado vazio. Conferir em 375px e em desktop.

Expected: o carrinho reflete cada ação, e o subtotal acompanha.

- [ ] **Step 8: Verificar build, lint e testes**

Run: `npm test && npx eslint && npm run build`
Expected: PASS nos três.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat(carrinho): pagina do carrinho e botao de adicionar com aviso de estoque"
```

---

### Task 9: Criação do pedido com reserva de estoque

**Files:**
- Create: `src/core/orders/order-repository.ts`, `src/core/orders/checkout-service.ts`
- Create: `src/db/repositories/drizzle-order-repository.ts`
- Test: `src/core/orders/checkout-service.test.ts`, `tests/integration/criar-pedido.test.ts`

**Interfaces:**
- Consumes: `CartRepository`, `StockRepository`, máquina de estados
- Produces:
  - `type DadosDoComprador = { nome: string; email: string; telefone: string; documento?: string }`
  - `interface OrderRepository { criar(args): Promise<Pedido>; porReferencia(ref): Promise<Pedido | null>; registrarTransicao(orderId, para, nota?): Promise<Result<Pedido>> }`
  - `createCheckoutService({ carrinho, estoque, pedidos })` com `.criarPedido(token, comprador)`
  - `gerarReferencia(): string`

- [ ] **Step 1: Escrever o teste do serviço falhando**

Criar `src/core/orders/checkout-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createCheckoutService } from "./checkout-service";
import type { Cart } from "@/core/cart/types";
import { ok, err } from "@/core/shared/result";

const carrinhoCheio: Cart = {
  id: "c1",
  token: "t1",
  itens: [
    {
      variantId: "v1",
      sku: "SKU-1",
      productName: "Primacy 4",
      productSlug: "michelin-primacy-4",
      sizeLabel: "205/55 R16 91V",
      unitPriceCents: 65000,
      quantity: 2,
      disponivel: 5,
    },
  ],
};

const comprador = {
  nome: "Maria",
  email: "maria@exemplo.test",
  telefone: "61999999999",
};

function dependencias(over: {
  cart?: Cart;
  reservaFalha?: boolean;
} = {}) {
  const carrinho = {
    obterOuCriar: vi.fn(async () => over.cart ?? carrinhoCheio),
    definirItem: vi.fn(),
    remover: vi.fn(),
    limpar: vi.fn(async () => {}),
  };
  const estoque = {
    reservar: vi.fn(async () =>
      over.reservaFalha
        ? err({ tipo: "indisponivel", variantId: "v1", pedido: 2, disponivel: 1 })
        : ok(undefined),
    ),
    liberarReserva: vi.fn(async () => {}),
  };
  const pedidos = {
    criar: vi.fn(async (args: { reference: string }) => ({
      id: "o1",
      reference: args.reference,
      status: "aguardando_pagamento" as const,
    })),
  };
  return { carrinho, estoque, pedidos };
}

describe("criarPedido", () => {
  it("recusa carrinho vazio", async () => {
    const d = dependencias({ cart: { id: "c", token: "t", itens: [] } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = createCheckoutService(d as any);

    const r = await s.criarPedido("t1", comprador);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("vazio");
    expect(d.estoque.reservar).not.toHaveBeenCalled();
  });

  it("reserva o estoque antes de criar o pedido", async () => {
    const d = dependencias();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = createCheckoutService(d as any);

    const r = await s.criarPedido("t1", comprador);
    expect(r.ok).toBe(true);
    expect(d.estoque.reservar).toHaveBeenCalledOnce();

    const args = d.estoque.reservar.mock.calls[0][0];
    expect(args.itens).toEqual([{ variantId: "v1", quantity: 2 }]);
    expect(args.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("não cria pedido quando a reserva falha", async () => {
    const d = dependencias({ reservaFalha: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = createCheckoutService(d as any);

    const r = await s.criarPedido("t1", comprador);
    expect(r.ok).toBe(false);
    expect(d.pedidos.criar).not.toHaveBeenCalled();
  });

  it("esvazia o carrinho depois de criar o pedido", async () => {
    const d = dependencias();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = createCheckoutService(d as any);

    await s.criarPedido("t1", comprador);
    expect(d.carrinho.limpar).toHaveBeenCalledWith("t1");
  });

  it("soma o total a partir dos itens", async () => {
    const d = dependencias();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = createCheckoutService(d as any);

    await s.criarPedido("t1", comprador);
    const args = d.pedidos.criar.mock.calls[0][0];
    expect(args.itemsTotalCents).toBe(130000);
    expect(args.totalCents).toBe(130000);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- checkout-service`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Escrever a porta do pedido**

Criar `src/core/orders/order-repository.ts`:

```ts
import type { Result } from "@/core/shared/result";
import type { OrderStatus } from "./order-status";

export type DadosDoComprador = {
  nome: string;
  email: string;
  telefone: string;
  documento?: string;
};

export type ItemDoPedido = {
  variantId: string;
  sku: string;
  productName: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
};

export type Pedido = {
  id: string;
  reference: string;
  status: OrderStatus;
};

export interface OrderRepository {
  criar(args: {
    reference: string;
    comprador: DadosDoComprador;
    itens: ItemDoPedido[];
    itemsTotalCents: number;
    totalCents: number;
  }): Promise<Pedido>;

  porReferencia(reference: string): Promise<Pedido | null>;

  registrarTransicao(
    orderId: string,
    para: OrderStatus,
    nota?: string,
  ): Promise<Result<Pedido>>;
}
```

- [ ] **Step 4: Escrever o serviço de checkout**

Criar `src/core/orders/checkout-service.ts`:

```ts
import { type Result, ok, err } from "@/core/shared/result";
import type { CartRepository } from "@/core/cart/cart-repository";
import type { StockRepository } from "@/core/stock/stock-repository";
import type {
  DadosDoComprador,
  OrderRepository,
  Pedido,
} from "./order-repository";

export const MINUTOS_DE_RESERVA = 30;

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Referência curta que o cliente lê no WhatsApp.
 *
 * Sem as letras I, O e os dígitos 0 e 1: quem dita o código por telefone
 * confunde os quatro, e o atendente procura um pedido que não existe.
 */
export function gerarReferencia(): string {
  let saida = "";
  for (let i = 0; i < 8; i++) {
    saida += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return `ZP-${saida}`;
}

type Dependencias = {
  carrinho: CartRepository;
  estoque: StockRepository;
  pedidos: OrderRepository;
};

export function createCheckoutService({
  carrinho,
  estoque,
  pedidos,
}: Dependencias) {
  return {
    /**
     * Reserva primeiro, cria o pedido depois.
     *
     * A ordem importa: se o pedido nascesse antes da reserva, uma falha de
     * estoque deixaria um pedido órfão que o cliente vê e a operação não
     * consegue cumprir.
     */
    async criarPedido(
      token: string,
      comprador: DadosDoComprador,
    ): Promise<Result<Pedido>> {
      const { itens } = await carrinho.obterOuCriar(token);

      if (itens.length === 0) {
        return err("Seu carrinho está vazio.");
      }

      const reference = gerarReferencia();
      const expiresAt = new Date(Date.now() + MINUTOS_DE_RESERVA * 60_000);

      const reserva = await estoque.reservar({
        orderRef: reference,
        itens: itens.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        expiresAt,
      });

      if (!reserva.ok) {
        const f = reserva.error;
        if (f.tipo === "indisponivel") {
          return err(
            f.disponivel === 0
              ? "Um item do seu carrinho esgotou. Remova-o para continuar."
              : `Um item do seu carrinho só tem ${f.disponivel} em estoque. Ajuste a quantidade.`,
          );
        }
        return err("Não foi possível reservar o estoque. Tente novamente.");
      }

      const itemsTotalCents = itens.reduce(
        (soma, i) => soma + i.unitPriceCents * i.quantity,
        0,
      );

      try {
        const pedido = await pedidos.criar({
          reference,
          comprador,
          itens: itens.map((i) => ({
            variantId: i.variantId,
            sku: i.sku,
            productName: i.productName,
            sizeLabel: i.sizeLabel,
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
          })),
          itemsTotalCents,
          // O frete entra no Plano 3; por ora o total é só o dos itens.
          totalCents: itemsTotalCents,
        });

        await carrinho.limpar(token);
        return ok(pedido);
      } catch (erro) {
        // Pedido não nasceu: a reserva não pode ficar segurando estoque.
        await estoque.liberarReserva(reference);
        throw erro;
      }
    },
  };
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- checkout-service`
Expected: PASS — 5 testes.

- [ ] **Step 6: Escrever o adaptador do pedido**

Criar `src/db/repositories/drizzle-order-repository.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { orders, orderItems, orderEvents } from "@/db/schema";
import type {
  ItemDoPedido,
  OrderRepository,
  Pedido,
} from "@/core/orders/order-repository";
import type { DadosDoComprador } from "@/core/orders/order-repository";
import { transicionar, type OrderStatus } from "@/core/orders/order-status";
import { type Result, ok, err } from "@/core/shared/result";

export function createDrizzleOrderRepository(db: Database): OrderRepository {
  return {
    async criar(args: {
      reference: string;
      comprador: DadosDoComprador;
      itens: ItemDoPedido[];
      itemsTotalCents: number;
      totalCents: number;
    }): Promise<Pedido> {
      return db.transaction(async (tx) => {
        const [pedido] = await tx
          .insert(orders)
          .values({
            reference: args.reference,
            customerName: args.comprador.nome,
            customerEmail: args.comprador.email,
            customerPhone: args.comprador.telefone,
            customerDocument: args.comprador.documento ?? null,
            itemsTotalCents: args.itemsTotalCents,
            totalCents: args.totalCents,
          })
          .returning();

        await tx.insert(orderItems).values(
          args.itens.map((i) => ({
            orderId: pedido.id,
            variantId: i.variantId,
            sku: i.sku,
            productName: i.productName,
            sizeLabel: i.sizeLabel,
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
          })),
        );

        await tx.insert(orderEvents).values({
          orderId: pedido.id,
          fromStatus: null,
          toStatus: "aguardando_pagamento",
          note: "Pedido criado",
        });

        return {
          id: pedido.id,
          reference: pedido.reference,
          status: pedido.status,
        };
      });
    },

    async porReferencia(reference: string): Promise<Pedido | null> {
      const [pedido] = await db
        .select({
          id: orders.id,
          reference: orders.reference,
          status: orders.status,
        })
        .from(orders)
        .where(eq(orders.reference, reference))
        .limit(1);

      return pedido ?? null;
    },

    async registrarTransicao(
      orderId: string,
      para: OrderStatus,
      nota?: string,
    ): Promise<Result<Pedido>> {
      const [atual] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!atual) return err("Pedido não encontrado.");

      const novo = transicionar(atual.status, para);
      if (!novo.ok) return err(novo.error);

      return db.transaction(async (tx) => {
        const [pedido] = await tx
          .update(orders)
          .set({ status: novo.value, updatedAt: new Date() })
          .where(eq(orders.id, orderId))
          .returning();

        await tx.insert(orderEvents).values({
          orderId,
          fromStatus: atual.status,
          toStatus: novo.value,
          note: nota ?? null,
        });

        return ok({
          id: pedido.id,
          reference: pedido.reference,
          status: pedido.status,
        });
      });
    },
  };
}
```

- [ ] **Step 7: Escrever o teste de integração ponta a ponta**

Criar `tests/integration/criar-pedido.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  testDb,
  limparBanco,
  limparEstoqueEPedidos,
  semearCatalogo,
  criarLocal,
} from "../helpers/db";
import * as schema from "@/db/schema";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";
import { createDrizzleCartRepository } from "@/db/repositories/drizzle-cart-repository";
import { createDrizzleOrderRepository } from "@/db/repositories/drizzle-order-repository";
import { createCheckoutService } from "@/core/orders/checkout-service";

const TOKEN = "token-pedido";
const COMPRADOR = {
  nome: "Maria Souza",
  email: "maria@exemplo.test",
  telefone: "61999999999",
};

let estoque: ReturnType<typeof createDrizzleStockRepository>;
let carrinho: ReturnType<typeof createDrizzleCartRepository>;
let checkout: ReturnType<typeof createCheckoutService>;
let variantId: string;

beforeEach(async () => {
  await limparEstoqueEPedidos();
  await limparBanco();
  await semearCatalogo();

  const local = await criarLocal();
  estoque = createDrizzleStockRepository(testDb, local.id);
  carrinho = createDrizzleCartRepository(testDb, estoque);
  checkout = createCheckoutService({
    carrinho,
    estoque,
    pedidos: createDrizzleOrderRepository(testDb),
  });

  const [v] = await testDb
    .select({ id: schema.productVariants.id })
    .from(schema.productVariants)
    .where(eq(schema.productVariants.sku, "MICH-PRIM4-2055516"));
  variantId = v.id;

  await estoque.registrarEntrada({
    variantId,
    quantity: 4,
    reason: "estoque inicial",
    authorId: "admin",
  });
});

describe("criar pedido ponta a ponta", () => {
  it("cria o pedido, reserva o estoque e esvazia o carrinho", async () => {
    await carrinho.definirItem(TOKEN, variantId, 2);

    const r = await checkout.criarPedido(TOKEN, COMPRADOR);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.reference).toMatch(/^ZP-[A-Z2-9]{8}$/);
    expect(r.value.status).toBe("aguardando_pagamento");

    const [d] = await estoque.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(4);
    expect(d.reserved).toBe(2);
    expect(d.disponivel).toBe(2);

    const { itens } = await carrinho.obterOuCriar(TOKEN);
    expect(itens).toEqual([]);
  });

  it("grava o evento de criação", async () => {
    await carrinho.definirItem(TOKEN, variantId, 1);
    const r = await checkout.criarPedido(TOKEN, COMPRADOR);
    if (!r.ok) throw new Error("pedido não criado");

    const eventos = await testDb
      .select()
      .from(schema.orderEvents)
      .where(eq(schema.orderEvents.orderId, r.value.id));

    expect(eventos).toHaveLength(1);
    expect(eventos[0].toStatus).toBe("aguardando_pagamento");
  });

  it("copia nome, SKU e preço para o item do pedido", async () => {
    await carrinho.definirItem(TOKEN, variantId, 1);
    const r = await checkout.criarPedido(TOKEN, COMPRADOR);
    if (!r.ok) throw new Error("pedido não criado");

    const [item] = await testDb
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, r.value.id));

    expect(item.sku).toBe("MICH-PRIM4-2055516");
    expect(item.productName).toBe("Primacy 4");
    expect(item.unitPriceCents).toBe(65000);
  });

  it("confirmar o pagamento baixa o estoque de fato", async () => {
    await carrinho.definirItem(TOKEN, variantId, 2);
    const r = await checkout.criarPedido(TOKEN, COMPRADOR);
    if (!r.ok) throw new Error("pedido não criado");

    await estoque.consumirReserva(r.value.reference);

    const [d] = await estoque.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(2);
    expect(d.reserved).toBe(0);
    expect(d.disponivel).toBe(2);
  });

  it("recusa pedido quando o carrinho está vazio", async () => {
    const r = await checkout.criarPedido("token-sem-nada", COMPRADOR);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 8: Rodar os testes e confirmar que passam**

Run: `npm test -- criar-pedido`
Expected: PASS — 5 testes.

- [ ] **Step 9: Rodar a suíte inteira**

Run: `npm test && npx eslint && npx tsc --noEmit`
Expected: PASS nos três.

- [ ] **Step 10: Commit**

```bash
git add src tests
git commit -m "feat(pedido): criacao a partir do carrinho com reserva de estoque"
```

---

### Task 10: Liberação de reservas vencidas

**Files:**
- Create: `src/app/api/cron/liberar-reservas/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `getStockRepository` (Task 7)
- Produces: `GET /api/cron/liberar-reservas`; agendamento na Vercel

- [ ] **Step 1: Escrever a rota**

Criar `src/app/api/cron/liberar-reservas/route.ts`:

```ts
import { getStockRepository } from "@/lib/container";

export const dynamic = "force-dynamic";

/**
 * Devolve ao estoque as reservas que venceram.
 *
 * Sem isto, um checkout abandonado seguraria o pneu para sempre e a loja
 * mostraria "esgotado" com mercadoria parada na prateleira.
 *
 * A Vercel envia CRON_SECRET no cabeçalho Authorization. Sem a checagem,
 * qualquer pessoa poderia disparar a rotina de fora.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo) {
    const enviado = request.headers.get("authorization");
    if (enviado !== `Bearer ${segredo}`) {
      return new Response("Não autorizado", { status: 401 });
    }
  }

  try {
    const estoque = await getStockRepository();
    const liberadas = await estoque.liberarVencidas(new Date());
    return Response.json({ liberadas });
  } catch (erro) {
    console.error("Falha ao liberar reservas vencidas", erro);
    return Response.json(
      { error: "Não foi possível liberar as reservas" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Agendar na Vercel**

Criar `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/liberar-reservas",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

A cada 10 minutos: uma reserva vence em 30, então o pneu volta à prateleira no máximo 10 minutos depois de vencer.

- [ ] **Step 3: Registrar a variável**

Adicionar ao `.env.example`:

```
# Segredo do agendamento da Vercel. Sem ele, a rota de liberação fica aberta.
CRON_SECRET=
```

- [ ] **Step 4: Verificar manualmente**

```bash
npm run dev
curl http://localhost:3000/api/cron/liberar-reservas
```

Expected: `{"liberadas":0}` num banco sem reservas vencidas.

- [ ] **Step 5: Verificar build, lint e testes**

Run: `npm test && npx eslint && npm run build`
Expected: PASS nos três.

- [ ] **Step 6: Commit**

```bash
git add src vercel.json .env.example
git commit -m "feat(estoque): rotina que devolve reservas vencidas a prateleira"
```

---

### Task 11: Seed de estoque e disponibilidade no catálogo

**Files:**
- Create: `scripts/seed-estoque.ts`
- Modify: `package.json`
- Modify: `src/db/repositories/drizzle-product-repository.ts`
- Modify: `src/components/produto/product-card.tsx`
- Test: `tests/integration/drizzle-product-repository.test.ts`

**Interfaces:**
- Consumes: `stockLocations`, `stockBalances` (Task 1)
- Produces: `npm run seed:estoque`; campo `disponivel` em `ProductSummary`

- [ ] **Step 1: Escrever o teste falhando**

Adicionar a `tests/integration/drizzle-product-repository.test.ts`:

```ts
describe("disponibilidade na listagem", () => {
  it("marca como esgotado o produto sem saldo", async () => {
    const r = await repo.search(base);
    const primacy = r.items.find((i) => i.slug === "michelin-primacy-4");
    expect(primacy?.disponivel).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- drizzle-product-repository`
Expected: FAIL — `disponivel` não existe em `ProductSummary`.

- [ ] **Step 3: Somar o campo ao tipo**

Em `src/core/catalog/types.ts`, adicionar a `ProductSummary`:

```ts
  /** Soma do disponível de todas as variantes do produto. Zero é esgotado. */
  disponivel: number;
```

- [ ] **Step 4: Preencher no adaptador**

Em `src/db/repositories/drizzle-product-repository.ts`, dentro de `linhasFiltradas`, somar ao `select`:

```ts
        onHand: stockBalances.onHand,
        reserved: stockBalances.reserved,
```

e, depois dos `innerJoin`, acrescentar:

```ts
      .leftJoin(stockBalances, eq(stockBalances.variantId, productVariants.id))
```

com `import { stockBalances } from "@/db/schema";` no topo. No objeto de `ProductSummary`, somar:

```ts
          disponivel: grupo.reduce(
            (soma, g) => soma + Math.max(0, (g.onHand ?? 0) - (g.reserved ?? 0)),
            0,
          ),
```

- [ ] **Step 5: Mostrar esgotado no card**

Em `src/components/produto/product-card.tsx`, logo abaixo do nome do produto:

```tsx
      {produto.disponivel === 0 && (
        <span className="mt-2 inline-block border border-neutral-300 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-tinta-media">
          Esgotado
        </span>
      )}
```

- [ ] **Step 6: Escrever o seed de estoque**

Criar `scripts/seed-estoque.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stockLocations, productVariants } from "@/db/schema";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";

async function main() {
  const quantidade = Number(process.argv[2] ?? 10);

  let [local] = await db
    .select()
    .from(stockLocations)
    .where(eq(stockLocations.slug, "brasilia"))
    .limit(1);

  if (!local) {
    [local] = await db
      .insert(stockLocations)
      .values({ name: "Brasília", slug: "brasilia", city: "Brasília" })
      .returning();
    console.log("Local de estoque criado: Brasília");
  }

  const estoque = createDrizzleStockRepository(db, local.id);
  const variantes = await db
    .select({ id: productVariants.id, sku: productVariants.sku })
    .from(productVariants);

  for (const v of variantes) {
    await estoque.registrarEntrada({
      variantId: v.id,
      quantity: quantidade,
      reason: "Carga inicial de estoque",
      authorId: "seed",
    });
  }

  console.log(
    `Estoque inicial de ${quantidade} unidades lançado em ${variantes.length} SKUs.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 7: Registrar o script**

Adicionar ao `package.json`:

```json
"seed:estoque": "tsx --env-file=.env.local scripts/seed-estoque.ts"
```

- [ ] **Step 8: Rodar o seed e conferir a loja**

```bash
npm run seed:estoque 10
npm run dev
```

Expected: os produtos deixam de aparecer como esgotados e o botão de adicionar fica ativo.

- [ ] **Step 9: Verificar tudo**

Run: `npm test && npx eslint && npm run build`
Expected: PASS nos três.

- [ ] **Step 10: Commit**

```bash
git add src scripts package.json tests
git commit -m "feat(catalogo): disponibilidade real e selo de esgotado"
```

---

## Estado ao fim do Plano 2

O cliente monta o carrinho, o estoque é reservado na criação do pedido, e nenhuma corrida consegue vender duas vezes o mesmo pneu — garantido por teste de concorrência contra Postgres real. O botão "Finalizar compra" existe e está desabilitado: é o ponto de partida do Plano 3.

Entregas do contrato que este plano fecha: **carrinho de compras** (5), **gestão de estoque** (8) e o modelo de **gestão de pedidos** (9).

**Plano 3 (Checkout, Pagamento e Frete)** começa pelas portas `PaymentProvider` e `ShippingProvider`, e pelo webhook idempotente que confirma o pagamento e consome a reserva.
