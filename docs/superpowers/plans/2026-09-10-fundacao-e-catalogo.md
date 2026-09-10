# Fundação e Catálogo — Plano de Implementação (Plano 1 de 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar um site Next.js com o catálogo de pneus do Zé Pneu navegável, buscável e filtrável por medida, marca e características.

**Architecture:** Monolito modular. A lógica de catálogo vive em `src/core/catalog` como funções puras que não conhecem HTTP nem React. O banco é acessado por uma porta (`ProductRepository`) implementada com Drizzle sobre Postgres. A web (Server Components) e a API pública (`/api/v1`) consomem o mesmo serviço de catálogo.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Drizzle ORM, Postgres (Supabase), Tailwind CSS v4, Zod, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-10-ecommerce-fase1-design.md`

## Global Constraints

- Node 22 ou superior. `npm` como gerenciador de pacotes.
- TypeScript em modo `strict`.
- **`src/core/**` não pode importar de `src/app/**`, `next/*` ou `react`.** Regra de lint obrigatória, verificada em CI.
- Domínio devolve `Result<T, E>` para falha esperada; exceção só para o inesperado.
- Todo texto visível ao usuário em português do Brasil.
- TDD: teste falhando primeiro, sempre. Commit ao fim de cada tarefa.
- Nomes de tabela e coluna em `snake_case`; identificadores TypeScript em `camelCase`.
- Toda tabela usa `uuid` como chave primária, com `gen_random_uuid()` como padrão.

---

## Estrutura de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/core/shared/result.ts` | Tipo `Result` e construtores `ok`/`err` |
| `src/core/catalog/tire-size.ts` | Medida de pneu: parse, formatação, validação |
| `src/core/catalog/types.ts` | Tipos de domínio: `Product`, `ProductVariant`, `CatalogFilters`, `Facets` |
| `src/core/catalog/product-repository.ts` | Porta: interface de acesso a produtos |
| `src/core/catalog/catalog-service.ts` | Regras de listagem, filtro e facetas |
| `src/db/schema/*.ts` | Tabelas Drizzle, uma por arquivo |
| `src/db/client.ts` | Conexão Postgres |
| `src/db/repositories/drizzle-product-repository.ts` | Adaptador da porta sobre Drizzle |
| `src/app/(loja)/pneus/page.tsx` | Listagem com filtros na URL |
| `src/app/(loja)/produto/[slug]/page.tsx` | Página de produto |
| `src/app/api/v1/products/route.ts` | API pública de catálogo |
| `scripts/import-catalog.ts` | Importação de catálogo por CSV |

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `src/core/shared/smoke.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: projeto executável com `npm run dev`, `npm test`, `npm run lint`, `npm run build`

- [ ] **Step 1: Criar o projeto Next.js**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --yes
```

- [ ] **Step 2: Instalar as dependências de teste e domínio**

```bash
npm install drizzle-orm postgres zod
npm install -D drizzle-kit vitest @vitejs/plugin-react vite-tsconfig-paths eslint-plugin-boundaries
```

- [ ] **Step 3: Configurar o Vitest**

Criar `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
```

Adicionar aos scripts do `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escrever o teste de fumaça**

Criar `src/core/shared/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("ambiente de teste", () => {
  it("executa testes do núcleo", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 1 teste.

- [ ] **Step 6: Proibir o núcleo de importar a camada web**

Substituir o conteúdo de `eslint.config.mjs`:

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "next", "next/*", "@/app/*", "@/components/*"],
              message:
                "src/core e dominio puro: nao pode depender da camada web. Veja a secao 2.1 da spec.",
            },
          ],
        },
      ],
    },
  },
];
```

- [ ] **Step 7: Verificar que a regra pega a violação**

Criar temporariamente `src/core/shared/violacao.ts` com `import { useState } from "react";` e rodar:

Run: `npm run lint`
Expected: FAIL com a mensagem "src/core e dominio puro".

Apagar o arquivo e rodar de novo.

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 8: Registrar as variáveis de ambiente**

Criar `.env.example`:

```
DATABASE_URL=postgresql://postgres:senha@localhost:5432/zepneu
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_NUMERO=5561999999999
```

Confirmar que `.gitignore` contém `.env*` e não ignora `.env.example`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js com TypeScript, Tailwind, Vitest e limite de camada"
```

---

### Task 2: Tipo Result e medida de pneu

Este é o núcleo puro do catálogo. A medida é a coisa que o cliente busca e a coisa que o admin digita errado — então ela ganha um tipo próprio, com parse e validação testados.

**Files:**
- Create: `src/core/shared/result.ts`
- Create: `src/core/catalog/tire-size.ts`
- Test: `src/core/catalog/tire-size.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }`
  - `ok<T>(value: T): Result<T, never>`
  - `err<E>(error: E): Result<never, E>`
  - `type TireSize = { width: number; profile: number; rim: number; loadIndex: number | null; speedRating: string | null }`
  - `parseTireSize(input: string): Result<TireSize>`
  - `formatTireSize(size: TireSize): string`
  - `tireSizeSlug(size: TireSize): string`

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/core/catalog/tire-size.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseTireSize, formatTireSize, tireSizeSlug } from "./tire-size";

describe("parseTireSize", () => {
  it("lê a medida completa com índices", () => {
    const r = parseTireSize("205/55 R16 91V");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      width: 205,
      profile: 55,
      rim: 16,
      loadIndex: 91,
      speedRating: "V",
    });
  });

  it("lê a medida sem os índices", () => {
    const r = parseTireSize("175/70 R14");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.loadIndex).toBeNull();
    expect(r.value.speedRating).toBeNull();
  });

  it("aceita as formas que o cliente digita na busca", () => {
    for (const entrada of ["205/55r16", "205 55 16", "205/55-R16"]) {
      const r = parseTireSize(entrada);
      expect(r.ok, `falhou em "${entrada}"`).toBe(true);
      if (!r.ok) continue;
      expect(r.value.width).toBe(205);
      expect(r.value.profile).toBe(55);
      expect(r.value.rim).toBe(16);
    }
  });

  it("rejeita medida fora da faixa fisicamente possível", () => {
    expect(parseTireSize("999/55 R16").ok).toBe(false);
    expect(parseTireSize("205/99 R16").ok).toBe(false);
    expect(parseTireSize("205/55 R99").ok).toBe(false);
  });

  it("rejeita entrada que não é medida", () => {
    expect(parseTireSize("michelin").ok).toBe(false);
    expect(parseTireSize("").ok).toBe(false);
  });
});

describe("formatTireSize", () => {
  it("formata no padrão que o cliente reconhece", () => {
    const r = parseTireSize("205/55r16 91v");
    if (!r.ok) throw new Error("parse falhou");
    expect(formatTireSize(r.value)).toBe("205/55 R16 91V");
  });
});

describe("tireSizeSlug", () => {
  it("gera slug estável para a URL da faceta", () => {
    const r = parseTireSize("205/55 R16 91V");
    if (!r.ok) throw new Error("parse falhou");
    expect(tireSizeSlug(r.value)).toBe("205-55-r16");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tire-size`
Expected: FAIL — `Failed to resolve import "./tire-size"`.

- [ ] **Step 3: Implementar o Result**

Criar `src/core/shared/result.ts`:

```ts
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

- [ ] **Step 4: Implementar a medida de pneu**

Criar `src/core/catalog/tire-size.ts`:

```ts
import { type Result, ok, err } from "@/core/shared/result";

export type TireSize = {
  width: number;
  profile: number;
  rim: number;
  loadIndex: number | null;
  speedRating: string | null;
};

const PADRAO =
  /^(\d{3})\s*[\/\s-]\s*(\d{2})\s*[\s-]?r?\s*(\d{2})(?:\s+(\d{2,3})\s*([a-z]{1,2}))?$/i;

const FAIXAS = {
  width: [125, 405],
  profile: [25, 90],
  rim: [10, 24],
  loadIndex: [50, 130],
} as const;

function dentroDaFaixa(valor: number, faixa: readonly [number, number]) {
  return valor >= faixa[0] && valor <= faixa[1];
}

export function parseTireSize(input: string): Result<TireSize> {
  const texto = input.trim();
  if (texto === "") return err("Medida vazia");

  const m = PADRAO.exec(texto);
  if (!m) return err(`Medida não reconhecida: "${input}"`);

  const width = Number(m[1]);
  const profile = Number(m[2]);
  const rim = Number(m[3]);
  const loadIndex = m[4] ? Number(m[4]) : null;
  const speedRating = m[5] ? m[5].toUpperCase() : null;

  if (!dentroDaFaixa(width, FAIXAS.width))
    return err(`Largura fora da faixa: ${width}`);
  if (!dentroDaFaixa(profile, FAIXAS.profile))
    return err(`Perfil fora da faixa: ${profile}`);
  if (!dentroDaFaixa(rim, FAIXAS.rim)) return err(`Aro fora da faixa: ${rim}`);
  if (loadIndex !== null && !dentroDaFaixa(loadIndex, FAIXAS.loadIndex))
    return err(`Índice de carga fora da faixa: ${loadIndex}`);

  return ok({ width, profile, rim, loadIndex, speedRating });
}

export function formatTireSize(size: TireSize): string {
  const base = `${size.width}/${size.profile} R${size.rim}`;
  if (size.loadIndex === null || size.speedRating === null) return base;
  return `${base} ${size.loadIndex}${size.speedRating}`;
}

export function tireSizeSlug(size: TireSize): string {
  return `${size.width}-${size.profile}-r${size.rim}`;
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- tire-size`
Expected: PASS — 7 testes.

- [ ] **Step 6: Commit**

```bash
git add src/core
git commit -m "feat(catalogo): tipo Result e medida de pneu com parse tolerante"
```

---

### Task 3: Banco de dados e schema de catálogo

**Files:**
- Create: `drizzle.config.ts`, `src/db/client.ts`
- Create: `src/db/schema/brands.ts`, `src/db/schema/categories.ts`, `src/db/schema/products.ts`, `src/db/schema/product-variants.ts`, `src/db/schema/product-media.ts`, `src/db/schema/index.ts`
- Create: `drizzle/0000_catalogo.sql` (gerado)

**Interfaces:**
- Consumes: nada
- Produces: tabelas `brands`, `categories`, `products`, `product_variants`, `product_media`; `db` exportado de `src/db/client.ts`

- [ ] **Step 1: Provisionar o Postgres**

Criar um projeto Supabase chamado `ze-pneu-dev`, copiar a connection string (modo *session*, porta 5432) para `DATABASE_URL` no `.env.local`.

- [ ] **Step 2: Configurar o Drizzle Kit**

Criar `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Adicionar aos scripts do `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 3: Escrever o cliente do banco**

Criar `src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não configurada");

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export type Database = typeof db;
```

- [ ] **Step 4: Escrever as tabelas de marca e categoria**

Criar `src/db/schema/brands.ts`:

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

Criar `src/db/schema/categories.ts`:

```ts
import { pgTable, uuid, text, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 5: Escrever as tabelas de produto**

Criar `src/db/schema/products.ts`:

```ts
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { brands } from "./brands";
import { categories } from "./categories";

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
```

Criar `src/db/schema/product-variants.ts`:

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
import { products } from "./products";

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

    // Dimensões para cotação de frete.
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
    unique("variants_sku_unique").on(t.sku),
  ],
);
```

Criar `src/db/schema/product-media.ts`:

```ts
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
```

Criar `src/db/schema/index.ts`:

```ts
export * from "./brands";
export * from "./categories";
export * from "./products";
export * from "./product-variants";
export * from "./product-media";
```

- [ ] **Step 6: Gerar e aplicar a migração**

```bash
npm run db:generate
npm run db:migrate
```

Expected: migração criada em `drizzle/` e aplicada sem erro.

- [ ] **Step 7: Confirmar que as tabelas existem**

```bash
npx drizzle-kit studio
```

Expected: as cinco tabelas aparecem. Fechar o studio.

- [ ] **Step 8: Commit**

```bash
git add drizzle.config.ts drizzle src/db package.json
git commit -m "feat(db): schema de catalogo com produtos, variantes e midia"
```

---

### Task 4: Porta do repositório e adaptador Drizzle

**Files:**
- Create: `src/core/catalog/types.ts`, `src/core/catalog/product-repository.ts`
- Create: `src/db/repositories/drizzle-product-repository.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/integration/drizzle-product-repository.test.ts`

**Interfaces:**
- Consumes: `TireSize` (Task 2), schema (Task 3)
- Produces:
  - `type CatalogFilters = { query?: string; brandSlugs?: string[]; widths?: number[]; profiles?: number[]; rims?: number[]; vehicleTypes?: string[]; minPriceCents?: number; maxPriceCents?: number; page: number; perPage: number }`
  - `type ProductSummary = { id, slug, name, brandName, imageUrl, altText, fromPriceCents, sizes }`
  - `type Facets = { brands: FacetCount[]; widths: FacetCount[]; profiles: FacetCount[]; rims: FacetCount[]; vehicleTypes: FacetCount[] }`
  - `interface ProductRepository { search(filters): Promise<{ items: ProductSummary[]; total: number; facets: Facets }>; findBySlug(slug): Promise<ProductDetail | null> }`
  - `createDrizzleProductRepository(db): ProductRepository`

- [ ] **Step 1: Escrever os tipos de domínio**

Criar `src/core/catalog/types.ts`:

```ts
export type FacetCount = { value: string; label: string; count: number };

export type Facets = {
  brands: FacetCount[];
  widths: FacetCount[];
  profiles: FacetCount[];
  rims: FacetCount[];
  vehicleTypes: FacetCount[];
};

export type CatalogFilters = {
  query?: string;
  brandSlugs?: string[];
  widths?: number[];
  profiles?: number[];
  rims?: number[];
  vehicleTypes?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  page: number;
  perPage: number;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  altText: string | null;
  fromPriceCents: number;
  sizes: string[];
};

export type VariantDetail = {
  id: string;
  sku: string;
  priceCents: number;
  sizeLabel: string | null;
  vehicleType: string | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brandName: string;
  media: { url: string; alt: string }[];
  variants: VariantDetail[];
};

export type SearchResult = {
  items: ProductSummary[];
  total: number;
  facets: Facets;
};
```

- [ ] **Step 2: Escrever a porta**

Criar `src/core/catalog/product-repository.ts`:

```ts
import type { CatalogFilters, ProductDetail, SearchResult } from "./types";

export interface ProductRepository {
  search(filters: CatalogFilters): Promise<SearchResult>;
  findBySlug(slug: string): Promise<ProductDetail | null>;
}
```

- [ ] **Step 3: Escrever o helper de teste de banco**

Criar `tests/helpers/db.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_TEST ou DATABASE_URL necessária");

const client = postgres(url, { prepare: false, max: 1 });
export const testDb = drizzle(client, { schema });

export async function limparBanco() {
  await testDb.execute(
    sql`TRUNCATE product_media, product_variants, products, categories, brands RESTART IDENTITY CASCADE`,
  );
}

export async function semearCatalogo() {
  const [marca] = await testDb
    .insert(schema.brands)
    .values({ name: "Michelin", slug: "michelin" })
    .returning();
  const [outraMarca] = await testDb
    .insert(schema.brands)
    .values({ name: "Pirelli", slug: "pirelli" })
    .returning();
  const [categoria] = await testDb
    .insert(schema.categories)
    .values({ name: "Pneus", slug: "pneus" })
    .returning();

  const [primacy] = await testDb
    .insert(schema.products)
    .values({
      brandId: marca.id,
      categoryId: categoria.id,
      name: "Primacy 4",
      slug: "michelin-primacy-4",
      description: "Pneu de passeio",
      status: "active",
    })
    .returning();

  const [cinturato] = await testDb
    .insert(schema.products)
    .values({
      brandId: outraMarca.id,
      categoryId: categoria.id,
      name: "Cinturato P7",
      slug: "pirelli-cinturato-p7",
      status: "active",
    })
    .returning();

  const dimensoes = {
    weightGrams: 9000,
    lengthMm: 640,
    widthMm: 640,
    heightMm: 210,
  };

  await testDb.insert(schema.productVariants).values([
    {
      productId: primacy.id,
      sku: "MICH-PRIM4-2055516",
      priceCents: 65000,
      width: 205,
      profile: 55,
      rim: 16,
      loadIndex: 91,
      speedRating: "V",
      vehicleType: "passeio",
      ...dimensoes,
    },
    {
      productId: primacy.id,
      sku: "MICH-PRIM4-1957515",
      priceCents: 52000,
      width: 195,
      profile: 75,
      rim: 15,
      loadIndex: 88,
      speedRating: "H",
      vehicleType: "passeio",
      ...dimensoes,
    },
    {
      productId: cinturato.id,
      sku: "PIRE-P7-2055516",
      priceCents: 58000,
      width: 205,
      profile: 55,
      rim: 16,
      loadIndex: 91,
      speedRating: "W",
      vehicleType: "passeio",
      ...dimensoes,
    },
  ]);

  await testDb.insert(schema.productMedia).values({
    productId: primacy.id,
    url: "https://exemplo.test/primacy.jpg",
    alt: "Michelin Primacy 4",
    position: 0,
  });

  return { primacy, cinturato, marca, outraMarca, categoria };
}
```

- [ ] **Step 4: Escrever o teste de integração falhando**

Criar `tests/integration/drizzle-product-repository.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb, limparBanco, semearCatalogo } from "../helpers/db";
import * as schema from "@/db/schema";
import { createDrizzleProductRepository } from "@/db/repositories/drizzle-product-repository";

const repo = createDrizzleProductRepository(testDb);
const base = { page: 1, perPage: 20 };

beforeEach(async () => {
  await limparBanco();
  await semearCatalogo();
});

describe("search", () => {
  it("devolve todos os produtos ativos", async () => {
    const r = await repo.search(base);
    expect(r.total).toBe(2);
    expect(r.items.map((i) => i.slug).sort()).toEqual([
      "michelin-primacy-4",
      "pirelli-cinturato-p7",
    ]);
  });

  it("mostra o menor preço entre as variantes", async () => {
    const r = await repo.search(base);
    const primacy = r.items.find((i) => i.slug === "michelin-primacy-4");
    expect(primacy?.fromPriceCents).toBe(52000);
  });

  it("filtra por medida", async () => {
    const r = await repo.search({ ...base, widths: [205], profiles: [55], rims: [16] });
    expect(r.total).toBe(2);

    const so195 = await repo.search({ ...base, widths: [195] });
    expect(so195.total).toBe(1);
    expect(so195.items[0].slug).toBe("michelin-primacy-4");
  });

  it("filtra por marca", async () => {
    const r = await repo.search({ ...base, brandSlugs: ["pirelli"] });
    expect(r.total).toBe(1);
    expect(r.items[0].brandName).toBe("Pirelli");
  });

  it("busca por texto no nome e na marca", async () => {
    const r = await repo.search({ ...base, query: "primacy" });
    expect(r.total).toBe(1);
    expect(r.items[0].slug).toBe("michelin-primacy-4");
  });

  it("conta facetas sobre o resultado filtrado", async () => {
    const r = await repo.search({ ...base, widths: [205] });
    const aro16 = r.facets.rims.find((f) => f.value === "16");
    expect(aro16?.count).toBe(2);
    expect(r.facets.brands).toHaveLength(2);
  });

  it("pagina", async () => {
    const r = await repo.search({ ...base, perPage: 1 });
    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(2);
  });

  it("devolve resultado vazio quando nada casa com o filtro", async () => {
    const r = await repo.search({ ...base, brandSlugs: ["inexistente"] });
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
  });

  it("esconde produto que não está ativo", async () => {
    await testDb
      .update(schema.products)
      .set({ status: "draft" })
      .where(eq(schema.products.slug, "pirelli-cinturato-p7"));

    const r = await repo.search(base);
    expect(r.total).toBe(1);
    expect(r.items[0].slug).toBe("michelin-primacy-4");
  });
});

describe("findBySlug", () => {
  it("devolve o produto com variantes e mídia", async () => {
    const p = await repo.findBySlug("michelin-primacy-4");
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Primacy 4");
    expect(p!.brandName).toBe("Michelin");
    expect(p!.variants).toHaveLength(2);
    expect(p!.media[0].url).toBe("https://exemplo.test/primacy.jpg");
  });

  it("formata a medida da variante para exibição", async () => {
    const p = await repo.findBySlug("michelin-primacy-4");
    const medidas = p!.variants.map((v) => v.sizeLabel).sort();
    expect(medidas).toEqual(["195/75 R15 88H", "205/55 R16 91V"]);
  });

  it("devolve null quando não existe", async () => {
    expect(await repo.findBySlug("nao-existe")).toBeNull();
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run: `npm test -- drizzle-product-repository`
Expected: FAIL — `Failed to resolve import ".../drizzle-product-repository"`.

- [ ] **Step 6: Implementar o adaptador**

Criar `src/db/repositories/drizzle-product-repository.ts`:

```ts
import { and, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { brands, productMedia, productVariants, products } from "@/db/schema";
import type { ProductRepository } from "@/core/catalog/product-repository";
import type {
  CatalogFilters,
  FacetCount,
  ProductDetail,
  ProductSummary,
  SearchResult,
} from "@/core/catalog/types";
import { formatTireSize } from "@/core/catalog/tire-size";

function rotuloMedida(v: {
  width: number | null;
  profile: number | null;
  rim: number | null;
  loadIndex: number | null;
  speedRating: string | null;
}): string | null {
  if (v.width === null || v.profile === null || v.rim === null) return null;
  return formatTireSize({
    width: v.width,
    profile: v.profile,
    rim: v.rim,
    loadIndex: v.loadIndex,
    speedRating: v.speedRating,
  });
}

function contar(valores: (string | null)[]): FacetCount[] {
  const mapa = new Map<string, number>();
  for (const v of valores) {
    if (v === null) continue;
    mapa.set(v, (mapa.get(v) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, "pt-BR", { numeric: true }));
}

export function createDrizzleProductRepository(db: Database): ProductRepository {
  async function linhasFiltradas(f: CatalogFilters) {
    const condicoes = [
      eq(products.status, "active"),
      eq(productVariants.status, "active"),
    ];

    if (f.brandSlugs?.length) condicoes.push(inArray(brands.slug, f.brandSlugs));
    if (f.widths?.length) condicoes.push(inArray(productVariants.width, f.widths));
    if (f.profiles?.length)
      condicoes.push(inArray(productVariants.profile, f.profiles));
    if (f.rims?.length) condicoes.push(inArray(productVariants.rim, f.rims));
    if (f.vehicleTypes?.length)
      condicoes.push(
        inArray(
          productVariants.vehicleType,
          f.vehicleTypes as ("passeio" | "suv" | "carga" | "moto")[],
        ),
      );
    if (f.minPriceCents !== undefined)
      condicoes.push(gte(productVariants.priceCents, f.minPriceCents));
    if (f.maxPriceCents !== undefined)
      condicoes.push(lte(productVariants.priceCents, f.maxPriceCents));

    if (f.query?.trim()) {
      const termo = `%${f.query.trim()}%`;
      const busca = or(ilike(products.name, termo), ilike(brands.name, termo));
      if (busca) condicoes.push(busca);
    }

    return db
      .select({
        productId: products.id,
        slug: products.slug,
        name: products.name,
        brandName: brands.name,
        brandSlug: brands.slug,
        priceCents: productVariants.priceCents,
        width: productVariants.width,
        profile: productVariants.profile,
        rim: productVariants.rim,
        loadIndex: productVariants.loadIndex,
        speedRating: productVariants.speedRating,
        vehicleType: productVariants.vehicleType,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(brands, eq(brands.id, products.brandId))
      .where(and(...condicoes));
  }

  return {
    async search(f: CatalogFilters): Promise<SearchResult> {
      const linhas = await linhasFiltradas(f);

      const porProduto = new Map<string, typeof linhas>();
      for (const linha of linhas) {
        const atual = porProduto.get(linha.productId) ?? [];
        atual.push(linha);
        porProduto.set(linha.productId, atual);
      }

      const ids = [...porProduto.keys()];
      const midias = ids.length
        ? await db
            .select({
              productId: productMedia.productId,
              url: productMedia.url,
              alt: productMedia.alt,
              position: productMedia.position,
            })
            .from(productMedia)
            .where(inArray(productMedia.productId, ids))
        : [];

      const capa = new Map<string, { url: string; alt: string }>();
      for (const m of [...midias].sort((a, b) => a.position - b.position)) {
        if (!capa.has(m.productId)) capa.set(m.productId, { url: m.url, alt: m.alt });
      }

      const todos: ProductSummary[] = ids.map((id) => {
        const grupo = porProduto.get(id)!;
        const primeira = grupo[0];
        const imagem = capa.get(id) ?? null;
        return {
          id,
          slug: primeira.slug,
          name: primeira.name,
          brandName: primeira.brandName,
          imageUrl: imagem?.url ?? null,
          altText: imagem?.alt ?? null,
          fromPriceCents: Math.min(...grupo.map((g) => g.priceCents)),
          sizes: [
            ...new Set(
              grupo.map(rotuloMedida).filter((s): s is string => s !== null),
            ),
          ].sort(),
        };
      });

      todos.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      const inicio = (f.page - 1) * f.perPage;
      const items = todos.slice(inicio, inicio + f.perPage);

      return {
        items,
        total: todos.length,
        facets: {
          brands: contar(linhas.map((l) => l.brandName)),
          widths: contar(linhas.map((l) => l.width?.toString() ?? null)),
          profiles: contar(linhas.map((l) => l.profile?.toString() ?? null)),
          rims: contar(linhas.map((l) => l.rim?.toString() ?? null)),
          vehicleTypes: contar(linhas.map((l) => l.vehicleType)),
        },
      };
    },

    async findBySlug(slug: string): Promise<ProductDetail | null> {
      const [produto] = await db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          description: products.description,
          brandName: brands.name,
        })
        .from(products)
        .innerJoin(brands, eq(brands.id, products.brandId))
        .where(and(eq(products.slug, slug), eq(products.status, "active")))
        .limit(1);

      if (!produto) return null;

      const variantes = await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, produto.id),
            eq(productVariants.status, "active"),
          ),
        );

      const midia = await db
        .select({ url: productMedia.url, alt: productMedia.alt })
        .from(productMedia)
        .where(eq(productMedia.productId, produto.id))
        .orderBy(productMedia.position);

      return {
        ...produto,
        media: midia,
        variants: variantes.map((v) => ({
          id: v.id,
          sku: v.sku,
          priceCents: v.priceCents,
          sizeLabel: rotuloMedida(v),
          vehicleType: v.vehicleType,
        })),
      };
    },
  };
}
```

- [ ] **Step 7: Rodar os testes e confirmar que passam**

Run: `npm test -- drizzle-product-repository`
Expected: PASS — 12 testes.

- [ ] **Step 8: Rodar a suíte inteira e o lint**

Run: `npm test && npm run lint`
Expected: PASS nos dois.

- [ ] **Step 9: Commit**

```bash
git add src/core src/db tests
git commit -m "feat(catalogo): porta ProductRepository e adaptador Drizzle com facetas"
```

---

### Task 5: Leitura dos filtros da URL

Os filtros vivem na URL para que o cliente compartilhe o link e o Google indexe. Isso significa que a tradução de `searchParams` para `CatalogFilters` é lógica de domínio testável, não código de página.

**Files:**
- Create: `src/core/catalog/filters.ts`
- Test: `src/core/catalog/filters.test.ts`

**Interfaces:**
- Consumes: `CatalogFilters` (Task 4)
- Produces:
  - `parseFilters(params: Record<string, string | string[] | undefined>): CatalogFilters`
  - `filtersToSearchParams(filters: CatalogFilters): URLSearchParams`

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/core/catalog/filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseFilters, filtersToSearchParams } from "./filters";

describe("parseFilters", () => {
  it("usa página 1 e 24 por página como padrão", () => {
    const f = parseFilters({});
    expect(f.page).toBe(1);
    expect(f.perPage).toBe(24);
  });

  it("lê valores múltiplos separados por vírgula", () => {
    const f = parseFilters({ aro: "15,16,17" });
    expect(f.rims).toEqual([15, 16, 17]);
  });

  it("lê valores múltiplos repetidos", () => {
    const f = parseFilters({ marca: ["michelin", "pirelli"] });
    expect(f.brandSlugs).toEqual(["michelin", "pirelli"]);
  });

  it("converte preço de reais para centavos", () => {
    const f = parseFilters({ preco_min: "300", preco_max: "900" });
    expect(f.minPriceCents).toBe(30000);
    expect(f.maxPriceCents).toBe(90000);
  });

  it("descarta número inválido em vez de quebrar a página", () => {
    const f = parseFilters({ aro: "abc,16", pagina: "-3" });
    expect(f.rims).toEqual([16]);
    expect(f.page).toBe(1);
  });

  it("limita perPage para impedir varredura do catálogo inteiro", () => {
    expect(parseFilters({ por_pagina: "5000" }).perPage).toBe(96);
  });

  it("lê a busca textual", () => {
    expect(parseFilters({ q: "primacy" }).query).toBe("primacy");
  });
});

describe("filtersToSearchParams", () => {
  it("faz a volta sem perder informação", () => {
    const original = parseFilters({
      aro: "16",
      marca: "michelin",
      q: "primacy",
      pagina: "2",
    });
    const refeito = parseFilters(
      Object.fromEntries(filtersToSearchParams(original)),
    );
    expect(refeito).toEqual(original);
  });

  it("omite os padrões para manter a URL limpa", () => {
    const params = filtersToSearchParams(parseFilters({}));
    expect(params.toString()).toBe("");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- filters`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `src/core/catalog/filters.ts`:

```ts
import type { CatalogFilters } from "./types";

type Params = Record<string, string | string[] | undefined>;

const PER_PAGE_PADRAO = 24;
const PER_PAGE_MAXIMO = 96;

function lista(valor: string | string[] | undefined): string[] {
  if (valor === undefined) return [];
  const bruto = Array.isArray(valor) ? valor : valor.split(",");
  return bruto.map((v) => v.trim()).filter((v) => v !== "");
}

function numeros(valor: string | string[] | undefined): number[] {
  return lista(valor)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

function inteiroPositivo(
  valor: string | string[] | undefined,
  padrao: number,
): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n > 0 ? n : padrao;
}

function reaisParaCentavos(
  valor: string | string[] | undefined,
): number | undefined {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

function texto(valor: string | string[] | undefined): string | undefined {
  const v = (Array.isArray(valor) ? valor[0] : valor)?.trim();
  return v ? v : undefined;
}

function vazioParaIndefinido<T>(arr: T[]): T[] | undefined {
  return arr.length ? arr : undefined;
}

export function parseFilters(params: Params): CatalogFilters {
  return {
    query: texto(params.q),
    brandSlugs: vazioParaIndefinido(lista(params.marca)),
    widths: vazioParaIndefinido(numeros(params.largura)),
    profiles: vazioParaIndefinido(numeros(params.perfil)),
    rims: vazioParaIndefinido(numeros(params.aro)),
    vehicleTypes: vazioParaIndefinido(lista(params.tipo)),
    minPriceCents: reaisParaCentavos(params.preco_min),
    maxPriceCents: reaisParaCentavos(params.preco_max),
    page: inteiroPositivo(params.pagina, 1),
    perPage: Math.min(
      inteiroPositivo(params.por_pagina, PER_PAGE_PADRAO),
      PER_PAGE_MAXIMO,
    ),
  };
}

export function filtersToSearchParams(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.query) p.set("q", f.query);
  if (f.brandSlugs?.length) p.set("marca", f.brandSlugs.join(","));
  if (f.widths?.length) p.set("largura", f.widths.join(","));
  if (f.profiles?.length) p.set("perfil", f.profiles.join(","));
  if (f.rims?.length) p.set("aro", f.rims.join(","));
  if (f.vehicleTypes?.length) p.set("tipo", f.vehicleTypes.join(","));
  if (f.minPriceCents !== undefined)
    p.set("preco_min", String(f.minPriceCents / 100));
  if (f.maxPriceCents !== undefined)
    p.set("preco_max", String(f.maxPriceCents / 100));
  if (f.page !== 1) p.set("pagina", String(f.page));
  if (f.perPage !== PER_PAGE_PADRAO) p.set("por_pagina", String(f.perPage));
  return p;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- filters`
Expected: PASS — 9 testes.

- [ ] **Step 5: Commit**

```bash
git add src/core/catalog
git commit -m "feat(catalogo): leitura e escrita de filtros na URL"
```

---

### Task 6: Serviço de catálogo e busca por medida colada

Quando o cliente digita "205/55 R16" na busca, isso não é texto — é uma medida. O serviço reconhece e converte em filtro estruturado. É o que faz a busca funcionar como o cliente espera.

**Files:**
- Create: `src/core/catalog/catalog-service.ts`
- Test: `src/core/catalog/catalog-service.test.ts`

**Interfaces:**
- Consumes: `ProductRepository` (Task 4), `parseTireSize` (Task 2), `CatalogFilters` (Task 4)
- Produces:
  - `createCatalogService(repo: ProductRepository)`
  - `.listar(filters: CatalogFilters): Promise<SearchResult>`
  - `.detalhe(slug: string): Promise<ProductDetail | null>`

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/core/catalog/catalog-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createCatalogService } from "./catalog-service";
import type { ProductRepository } from "./product-repository";
import type { CatalogFilters, SearchResult } from "./types";

const vazio: SearchResult = {
  items: [],
  total: 0,
  facets: { brands: [], widths: [], profiles: [], rims: [], vehicleTypes: [] },
};

function repoFalso() {
  const search = vi.fn<(f: CatalogFilters) => Promise<SearchResult>>(
    async () => vazio,
  );
  const findBySlug = vi.fn(async () => null);
  return { search, findBySlug } satisfies ProductRepository;
}

const base: CatalogFilters = { page: 1, perPage: 24 };

describe("listar", () => {
  it("converte busca por medida em filtro estruturado", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).listar({ ...base, query: "205/55 R16" });

    const usado = repo.search.mock.calls[0][0];
    expect(usado.widths).toEqual([205]);
    expect(usado.profiles).toEqual([55]);
    expect(usado.rims).toEqual([16]);
    expect(usado.query).toBeUndefined();
  });

  it("aceita a medida do jeito que o cliente digita", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).listar({ ...base, query: "205 55 16" });
    expect(repo.search.mock.calls[0][0].rims).toEqual([16]);
  });

  it("mantém como texto o que não é medida", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).listar({ ...base, query: "michelin" });

    const usado = repo.search.mock.calls[0][0];
    expect(usado.query).toBe("michelin");
    expect(usado.widths).toBeUndefined();
  });

  it("não sobrescreve filtro de medida já escolhido nas facetas", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).listar({
      ...base,
      query: "205/55 R16",
      rims: [17],
    });
    expect(repo.search.mock.calls[0][0].rims).toEqual([17]);
  });

  it("repassa o resultado do repositório", async () => {
    const repo = repoFalso();
    const r = await createCatalogService(repo).listar(base);
    expect(r).toBe(vazio);
  });
});

describe("detalhe", () => {
  it("delega ao repositório", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).detalhe("michelin-primacy-4");
    expect(repo.findBySlug).toHaveBeenCalledWith("michelin-primacy-4");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- catalog-service`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `src/core/catalog/catalog-service.ts`:

```ts
import type { ProductRepository } from "./product-repository";
import type { CatalogFilters, ProductDetail, SearchResult } from "./types";
import { parseTireSize } from "./tire-size";

/**
 * Quando a busca textual é na verdade uma medida ("205/55 R16"), converte
 * em filtro estruturado. Filtro já escolhido pelo cliente nas facetas tem
 * precedência — a busca não pode desfazer o que ele clicou.
 */
function normalizar(filtros: CatalogFilters): CatalogFilters {
  if (!filtros.query) return filtros;

  const medida = parseTireSize(filtros.query);
  if (!medida.ok) return filtros;

  return {
    ...filtros,
    query: undefined,
    widths: filtros.widths ?? [medida.value.width],
    profiles: filtros.profiles ?? [medida.value.profile],
    rims: filtros.rims ?? [medida.value.rim],
  };
}

export function createCatalogService(repo: ProductRepository) {
  return {
    listar(filtros: CatalogFilters): Promise<SearchResult> {
      return repo.search(normalizar(filtros));
    },
    detalhe(slug: string): Promise<ProductDetail | null> {
      return repo.findBySlug(slug);
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- catalog-service`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/core/catalog
git commit -m "feat(catalogo): servico de catalogo com busca por medida colada"
```

---

### Task 7: API pública de catálogo

**Files:**
- Create: `src/lib/container.ts`
- Create: `src/app/api/v1/products/route.ts`
- Test: `tests/integration/api-products.test.ts`

**Interfaces:**
- Consumes: `createCatalogService` (Task 6), `createDrizzleProductRepository` (Task 4), `parseFilters` (Task 5)
- Produces: `GET /api/v1/products` → `{ items, total, page, perPage, facets }`; `getCatalogService(): CatalogService`

- [ ] **Step 1: Escrever o teste falhando**

Criar `tests/integration/api-products.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { limparBanco, semearCatalogo } from "../helpers/db";
import { GET } from "@/app/api/v1/products/route";

beforeEach(async () => {
  await limparBanco();
  await semearCatalogo();
});

function requisicao(qs = "") {
  return new Request(`http://localhost:3000/api/v1/products${qs}`);
}

describe("GET /api/v1/products", () => {
  it("devolve o catálogo com metadados de paginação", async () => {
    const res = await GET(requisicao());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(24);
    expect(body.items).toHaveLength(2);
  });

  it("aplica os filtros da query string", async () => {
    const res = await GET(requisicao("?marca=pirelli"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].brandName).toBe("Pirelli");
  });

  it("entende medida colada na busca", async () => {
    const res = await GET(requisicao("?q=195%2F75%20R15"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].slug).toBe("michelin-primacy-4");
  });

  it("devolve facetas", async () => {
    const res = await GET(requisicao());
    const body = await res.json();
    expect(body.facets.brands).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- api-products`
Expected: FAIL — módulo da rota não encontrado.

- [ ] **Step 3: Escrever o container**

Criar `src/lib/container.ts`:

```ts
import { db } from "@/db/client";
import { createDrizzleProductRepository } from "@/db/repositories/drizzle-product-repository";
import { createCatalogService } from "@/core/catalog/catalog-service";

let catalogo: ReturnType<typeof createCatalogService> | null = null;

export function getCatalogService() {
  catalogo ??= createCatalogService(createDrizzleProductRepository(db));
  return catalogo;
}
```

- [ ] **Step 4: Escrever a rota**

Criar `src/app/api/v1/products/route.ts`:

```ts
import { parseFilters } from "@/core/catalog/filters";
import { getCatalogService } from "@/lib/container";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  for (const [chave, valor] of url.searchParams) params[chave] = valor;

  const filtros = parseFilters(params);

  try {
    const resultado = await getCatalogService().listar(filtros);
    return Response.json({
      items: resultado.items,
      total: resultado.total,
      page: filtros.page,
      perPage: filtros.perPage,
      facets: resultado.facets,
    });
  } catch (erro) {
    console.error("Falha ao listar catálogo", erro);
    return Response.json(
      { error: "Não foi possível carregar o catálogo" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- api-products`
Expected: PASS — 4 testes.

- [ ] **Step 6: Commit**

```bash
git add src/app src/lib tests
git commit -m "feat(api): GET /api/v1/products com filtros e facetas"
```

---

### Task 8: Página de listagem de pneus

**Files:**
- Create: `src/lib/format.ts`
- Create: `src/components/produto/product-card.tsx`
- Create: `src/components/catalogo/filtro-facetas.tsx`
- Create: `src/components/catalogo/paginacao.tsx`
- Create: `src/app/(loja)/pneus/page.tsx`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: `getCatalogService` (Task 7), `parseFilters`/`filtersToSearchParams` (Task 5), `ProductSummary`/`Facets` (Task 4)
- Produces: rota `/pneus`; `formatBRL(cents: number): string`

- [ ] **Step 1: Escrever o teste de formatação falhando**

Criar `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatBRL } from "./format";

// Intl usa espaco nao-quebravel (U+00A0) depois do "R$". Normalizamos
// para espaco comum, senao a assercao falha por um caractere invisivel.
const normalizar = (s: string) => s.replace(/ /g, " ");

describe("formatBRL", () => {
  it("formata centavos como moeda brasileira", () => {
    expect(normalizar(formatBRL(65000))).toBe("R$ 650,00");
  });

  it("formata valor quebrado", () => {
    expect(normalizar(formatBRL(52990))).toBe("R$ 529,90");
  });

  it("formata milhar com separador brasileiro", () => {
    expect(normalizar(formatBRL(125090))).toBe("R$ 1.250,90");
  });

  it("formata zero", () => {
    expect(normalizar(formatBRL(0))).toBe("R$ 0,00");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- format`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar a formatação**

Criar `src/lib/format.ts`:

```ts
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- format`
Expected: PASS — 4 testes.

- [ ] **Step 5: Escrever o card de produto**

Criar `src/components/produto/product-card.tsx`:

```tsx
import Link from "next/link";
import type { ProductSummary } from "@/core/catalog/types";
import { formatBRL } from "@/lib/format";

export function ProductCard({ produto }: { produto: ProductSummary }) {
  return (
    <Link
      href={`/produto/${produto.slug}`}
      className="group flex flex-col rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 hover:shadow-sm"
    >
      <div className="mb-3 aspect-square overflow-hidden rounded bg-neutral-100">
        {produto.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produto.imageUrl}
            alt={produto.altText ?? produto.name}
            className="h-full w-full object-contain transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            Sem imagem
          </div>
        )}
      </div>

      <span className="text-xs uppercase tracking-wide text-neutral-500">
        {produto.brandName}
      </span>
      <h3 className="mt-1 font-medium text-neutral-900">{produto.name}</h3>

      {produto.sizes.length > 0 && (
        <p className="mt-1 text-sm text-neutral-600">
          {produto.sizes.slice(0, 3).join(" · ")}
          {produto.sizes.length > 3 && ` +${produto.sizes.length - 3}`}
        </p>
      )}

      <p className="mt-auto pt-3 text-lg font-semibold text-neutral-900">
        <span className="text-sm font-normal text-neutral-500">a partir de </span>
        {formatBRL(produto.fromPriceCents)}
      </p>
    </Link>
  );
}
```

- [ ] **Step 6: Escrever o filtro de facetas**

Criar `src/components/catalogo/filtro-facetas.tsx`:

```tsx
import Link from "next/link";
import type { FacetCount } from "@/core/catalog/types";

type Props = {
  titulo: string;
  chave: string;
  opcoes: FacetCount[];
  selecionados: string[];
  paramsAtuais: URLSearchParams;
};

export function FiltroFacetas({
  titulo,
  chave,
  opcoes,
  selecionados,
  paramsAtuais,
}: Props) {
  if (opcoes.length === 0) return null;

  function hrefAlternando(valor: string) {
    const params = new URLSearchParams(paramsAtuais);
    const novos = selecionados.includes(valor)
      ? selecionados.filter((s) => s !== valor)
      : [...selecionados, valor];

    if (novos.length) params.set(chave, novos.join(","));
    else params.delete(chave);
    params.delete("pagina");

    const qs = params.toString();
    return qs ? `/pneus?${qs}` : "/pneus";
  }

  return (
    <fieldset className="border-b border-neutral-200 py-4">
      <legend className="mb-2 text-sm font-semibold text-neutral-900">
        {titulo}
      </legend>
      <ul className="space-y-1">
        {opcoes.map((opcao) => {
          const ativo = selecionados.includes(opcao.value);
          return (
            <li key={opcao.value}>
              <Link
                href={hrefAlternando(opcao.value)}
                aria-current={ativo ? "true" : undefined}
                className={`flex justify-between rounded px-2 py-1 text-sm transition hover:bg-neutral-100 ${
                  ativo ? "font-semibold text-neutral-900" : "text-neutral-600"
                }`}
              >
                <span>
                  {ativo ? "✓ " : ""}
                  {opcao.label}
                </span>
                <span className="text-neutral-400">{opcao.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
```

- [ ] **Step 7: Escrever a paginação**

Criar `src/components/catalogo/paginacao.tsx`:

```tsx
import Link from "next/link";

type Props = {
  page: number;
  perPage: number;
  total: number;
  paramsAtuais: URLSearchParams;
};

export function Paginacao({ page, perPage, total, paramsAtuais }: Props) {
  const ultimaPagina = Math.max(1, Math.ceil(total / perPage));
  if (ultimaPagina === 1) return null;

  function href(destino: number) {
    const params = new URLSearchParams(paramsAtuais);
    if (destino === 1) params.delete("pagina");
    else params.set("pagina", String(destino));
    const qs = params.toString();
    return qs ? `/pneus?${qs}` : "/pneus";
  }

  const classe =
    "rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100";

  return (
    <nav
      aria-label="Paginação"
      className="mt-8 flex items-center justify-center gap-4"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={classe} rel="prev">
          Anterior
        </Link>
      ) : (
        <span className={`${classe} opacity-40`}>Anterior</span>
      )}

      <span className="text-sm text-neutral-600">
        Página {page} de {ultimaPagina}
      </span>

      {page < ultimaPagina ? (
        <Link href={href(page + 1)} className={classe} rel="next">
          Próxima
        </Link>
      ) : (
        <span className={`${classe} opacity-40`}>Próxima</span>
      )}
    </nav>
  );
}
```

- [ ] **Step 8: Escrever a página de listagem**

Criar `src/app/(loja)/pneus/page.tsx`:

```tsx
import type { Metadata } from "next";
import { parseFilters, filtersToSearchParams } from "@/core/catalog/filters";
import { getCatalogService } from "@/lib/container";
import { ProductCard } from "@/components/produto/product-card";
import { FiltroFacetas } from "@/components/catalogo/filtro-facetas";
import { Paginacao } from "@/components/catalogo/paginacao";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Pneus | Zé Pneu",
  description:
    "Pneus de todas as medidas e marcas, com entrega em todo o Brasil e retirada em Brasília.",
};

export default async function PneusPage({ searchParams }: Props) {
  const params = await searchParams;
  const filtros = parseFilters(params);
  const { items, total, facets } = await getCatalogService().listar(filtros);
  const atuais = filtersToSearchParams(filtros);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold text-neutral-900">Pneus</h1>
      <p className="mt-1 text-neutral-600">
        {total === 0
          ? "Nenhum produto encontrado"
          : `${total} ${total === 1 ? "produto" : "produtos"}`}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside>
          <FiltroFacetas
            titulo="Marca"
            chave="marca"
            opcoes={facets.brands}
            selecionados={filtros.brandSlugs ?? []}
            paramsAtuais={atuais}
          />
          <FiltroFacetas
            titulo="Largura"
            chave="largura"
            opcoes={facets.widths}
            selecionados={(filtros.widths ?? []).map(String)}
            paramsAtuais={atuais}
          />
          <FiltroFacetas
            titulo="Perfil"
            chave="perfil"
            opcoes={facets.profiles}
            selecionados={(filtros.profiles ?? []).map(String)}
            paramsAtuais={atuais}
          />
          <FiltroFacetas
            titulo="Aro"
            chave="aro"
            opcoes={facets.rims}
            selecionados={(filtros.rims ?? []).map(String)}
            paramsAtuais={atuais}
          />
          <FiltroFacetas
            titulo="Tipo de veículo"
            chave="tipo"
            opcoes={facets.vehicleTypes}
            selecionados={filtros.vehicleTypes ?? []}
            paramsAtuais={atuais}
          />
        </aside>

        <section>
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 p-12 text-center text-neutral-500">
              Não encontramos pneus com esses filtros. Tente remover algum ou
              buscar pela medida, como 205/55 R16.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((produto) => (
                <ProductCard key={produto.id} produto={produto} />
              ))}
            </div>
          )}

          <Paginacao
            page={filtros.page}
            perPage={filtros.perPage}
            total={total}
            paramsAtuais={atuais}
          />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Verificar o build e o lint**

Run: `npm test && npm run lint && npm run build`
Expected: PASS nos três.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat(loja): pagina de listagem com filtros facetados na URL"
```

---

### Task 9: Página de produto

**Files:**
- Create: `src/app/(loja)/produto/[slug]/page.tsx`
- Create: `src/components/produto/seletor-medida.tsx`
- Create: `src/components/whatsapp-link.tsx`

**Interfaces:**
- Consumes: `getCatalogService` (Task 7), `ProductDetail`/`VariantDetail` (Task 4), `formatBRL` (Task 8)
- Produces: rota `/produto/[slug]`; `WhatsAppLink`

- [ ] **Step 1: Escrever o link de WhatsApp**

Criar `src/components/whatsapp-link.tsx`:

```tsx
type Props = { mensagem: string; children: React.ReactNode; className?: string };

export function WhatsAppLink({ mensagem, children, className }: Props) {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO;
  if (!numero) return null;

  const href = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
```

- [ ] **Step 2: Escrever o seletor de medida**

Criar `src/components/produto/seletor-medida.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { VariantDetail } from "@/core/catalog/types";
import { formatBRL } from "@/lib/format";

export function SeletorMedida({ variantes }: { variantes: VariantDetail[] }) {
  const [selecionadaId, setSelecionadaId] = useState(variantes[0]?.id ?? "");
  const selecionada =
    variantes.find((v) => v.id === selecionadaId) ?? variantes[0];

  if (!selecionada) return null;

  return (
    <div>
      {variantes.length > 1 && (
        <fieldset className="mb-6">
          <legend className="mb-2 text-sm font-semibold text-neutral-900">
            Escolha a medida
          </legend>
          <div className="flex flex-wrap gap-2">
            {variantes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelecionadaId(v.id)}
                aria-pressed={v.id === selecionadaId}
                className={`rounded border px-3 py-2 text-sm transition ${
                  v.id === selecionadaId
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
                }`}
              >
                {v.sizeLabel ?? v.sku}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-3xl font-bold text-neutral-900">
        {formatBRL(selecionada.priceCents)}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        Código: {selecionada.sku}
      </p>

      <button
        type="button"
        disabled
        title="O carrinho entra no Plano 2"
        className="mt-6 w-full rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Adicionar ao carrinho
      </button>
    </div>
  );
}
```

O botão nasce desabilitado de propósito: o carrinho é o Plano 2. Deixá-lo visível e inerte é honesto com quem navega o preview e evita um layout que muda de forma depois.

- [ ] **Step 3: Escrever a página de produto**

Criar `src/app/(loja)/produto/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogService } from "@/lib/container";
import { SeletorMedida } from "@/components/produto/seletor-medida";
import { WhatsAppLink } from "@/components/whatsapp-link";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const produto = await getCatalogService().detalhe(slug);
  if (!produto) return { title: "Produto não encontrado | Zé Pneu" };

  const medidas = produto.variants
    .map((v) => v.sizeLabel)
    .filter(Boolean)
    .join(", ");

  return {
    title: `${produto.brandName} ${produto.name} | Zé Pneu`,
    description:
      produto.description ??
      `${produto.brandName} ${produto.name}${medidas ? ` nas medidas ${medidas}` : ""}. Entrega em todo o Brasil e retirada em Brasília.`,
  };
}

export default async function ProdutoPage({ params }: Props) {
  const { slug } = await params;
  const produto = await getCatalogService().detalhe(slug);
  if (!produto) notFound();

  const capa = produto.media[0];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-lg bg-neutral-100">
          {capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capa.url}
              alt={capa.alt}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-400">
              Sem imagem
            </div>
          )}
        </div>

        <div>
          <span className="text-sm uppercase tracking-wide text-neutral-500">
            {produto.brandName}
          </span>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">
            {produto.name}
          </h1>

          {produto.description && (
            <p className="mt-4 text-neutral-600">{produto.description}</p>
          )}

          <div className="mt-8">
            <SeletorMedida variantes={produto.variants} />
          </div>

          <WhatsAppLink
            mensagem={`Olá! Tenho uma dúvida sobre o ${produto.brandName} ${produto.name}.`}
            className="mt-4 block w-full rounded-lg border border-neutral-300 px-6 py-3 text-center font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Tirar dúvida no WhatsApp
          </WhatsAppLink>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verificar o build e o lint**

Run: `npm test && npm run lint && npm run build`
Expected: PASS nos três.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(loja): pagina de produto com seletor de medida e WhatsApp"
```

---

### Task 10: Importação de catálogo por CSV

**Files:**
- Create: `src/core/catalog/csv-import.ts`
- Create: `scripts/import-catalog.ts`
- Create: `docs/importacao-catalogo.md`
- Test: `src/core/catalog/csv-import.test.ts`

**Interfaces:**
- Consumes: `parseTireSize` (Task 2), `Result` (Task 2)
- Produces:
  - `type LinhaCatalogo = { marca: string; categoria: string; produto: string; descricao: string | null; sku: string; ean: string | null; precoCents: number; medida: TireSize | null; tipoVeiculo: string | null; pesoGramas: number; imagemUrl: string | null }`
  - `parseLinhasCatalogo(csv: string): { linhas: LinhaCatalogo[]; erros: { linha: number; motivo: string }[] }`

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/core/catalog/csv-import.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseLinhasCatalogo } from "./csv-import";

const CABECALHO =
  "marca,categoria,produto,descricao,sku,ean,preco,medida,tipo_veiculo,peso_gramas,imagem_url";

describe("parseLinhasCatalogo", () => {
  it("lê uma linha válida", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,Primacy 4,Pneu de passeio,MICH-2055516,789123,650.00,205/55 R16 91V,passeio,9000,https://ex.test/a.jpg`;

    const { linhas, erros } = parseLinhasCatalogo(csv);
    expect(erros).toEqual([]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].sku).toBe("MICH-2055516");
    expect(linhas[0].precoCents).toBe(65000);
    expect(linhas[0].medida?.rim).toBe(16);
  });

  it("aceita preço no formato brasileiro", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,Primacy 4,,MICH-1,,"1.250,90",205/55 R16,passeio,9000,`;
    const { linhas, erros } = parseLinhasCatalogo(csv);
    expect(erros).toEqual([]);
    expect(linhas[0].precoCents).toBe(125090);
  });

  it("relata a linha com medida inválida sem abortar as outras", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,Primacy 4,,MICH-1,,650.00,medida-errada,passeio,9000,
Pirelli,Pneus,P7,,PIRE-1,,580.00,205/55 R16,passeio,9000,`;

    const { linhas, erros } = parseLinhasCatalogo(csv);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].sku).toBe("PIRE-1");
    expect(erros).toHaveLength(1);
    expect(erros[0].linha).toBe(2);
    expect(erros[0].motivo).toContain("Medida");
  });

  it("exige os campos obrigatórios", () => {
    const csv = `${CABECALHO}
,Pneus,Primacy 4,,MICH-1,,650.00,205/55 R16,passeio,9000,`;
    const { erros } = parseLinhasCatalogo(csv);
    expect(erros[0].motivo).toContain("marca");
  });

  it("rejeita SKU repetido no mesmo arquivo", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,A,,DUP,,650.00,205/55 R16,passeio,9000,
Michelin,Pneus,B,,DUP,,650.00,195/75 R15,passeio,9000,`;
    const { erros } = parseLinhasCatalogo(csv);
    expect(erros).toHaveLength(1);
    expect(erros[0].motivo).toContain("repetido");
  });

  it("rejeita cabeçalho com coluna faltando", () => {
    const { erros } = parseLinhasCatalogo("marca,produto\nMichelin,A");
    expect(erros[0].motivo).toContain("Coluna");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- csv-import`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `src/core/catalog/csv-import.ts`:

```ts
import { parseTireSize, type TireSize } from "./tire-size";

export type LinhaCatalogo = {
  marca: string;
  categoria: string;
  produto: string;
  descricao: string | null;
  sku: string;
  ean: string | null;
  precoCents: number;
  medida: TireSize | null;
  tipoVeiculo: string | null;
  pesoGramas: number;
  imagemUrl: string | null;
};

export type ErroImportacao = { linha: number; motivo: string };

const COLUNAS = [
  "marca",
  "categoria",
  "produto",
  "descricao",
  "sku",
  "ean",
  "preco",
  "medida",
  "tipo_veiculo",
  "peso_gramas",
  "imagem_url",
] as const;

/** CSV com suporte a campo entre aspas contendo vírgula. */
function dividirLinha(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (c === "," && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** Aceita "650.00", "650,00" e "1.250,90". */
function precoParaCentavos(bruto: string): number | null {
  const texto = bruto.trim();
  if (texto === "") return null;

  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function ouNulo(valor: string): string | null {
  return valor === "" ? null : valor;
}

export function parseLinhasCatalogo(csv: string): {
  linhas: LinhaCatalogo[];
  erros: ErroImportacao[];
} {
  const linhasBrutas = csv
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  if (linhasBrutas.length === 0)
    return { linhas: [], erros: [{ linha: 0, motivo: "Arquivo vazio" }] };

  const cabecalho = dividirLinha(linhasBrutas[0]).map((c) => c.toLowerCase());
  const faltando = COLUNAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length)
    return {
      linhas: [],
      erros: [{ linha: 0, motivo: `Coluna faltando: ${faltando.join(", ")}` }],
    };

  const indice = (nome: string) => cabecalho.indexOf(nome);

  const linhas: LinhaCatalogo[] = [];
  const erros: ErroImportacao[] = [];
  const skusVistos = new Set<string>();

  for (let i = 1; i < linhasBrutas.length; i++) {
    const numero = i;
    const campos = dividirLinha(linhasBrutas[i]);
    const ler = (nome: string) => campos[indice(nome)] ?? "";

    const marca = ler("marca");
    const categoria = ler("categoria");
    const produto = ler("produto");
    const sku = ler("sku");

    const obrigatorios = { marca, categoria, produto, sku };
    const vazio = Object.entries(obrigatorios).find(([, v]) => v === "");
    if (vazio) {
      erros.push({ linha: numero, motivo: `Campo obrigatório vazio: ${vazio[0]}` });
      continue;
    }

    if (skusVistos.has(sku)) {
      erros.push({ linha: numero, motivo: `SKU repetido no arquivo: ${sku}` });
      continue;
    }

    const precoCents = precoParaCentavos(ler("preco"));
    if (precoCents === null) {
      erros.push({ linha: numero, motivo: `Preço inválido: "${ler("preco")}"` });
      continue;
    }

    const pesoGramas = Number(ler("peso_gramas"));
    if (!Number.isFinite(pesoGramas) || pesoGramas <= 0) {
      erros.push({
        linha: numero,
        motivo: `Peso inválido: "${ler("peso_gramas")}" (necessário para cotar frete)`,
      });
      continue;
    }

    let medida: TireSize | null = null;
    const medidaBruta = ler("medida");
    if (medidaBruta !== "") {
      const r = parseTireSize(medidaBruta);
      if (!r.ok) {
        erros.push({ linha: numero, motivo: r.error });
        continue;
      }
      medida = r.value;
    }

    skusVistos.add(sku);
    linhas.push({
      marca,
      categoria,
      produto,
      descricao: ouNulo(ler("descricao")),
      sku,
      ean: ouNulo(ler("ean")),
      precoCents,
      medida,
      tipoVeiculo: ouNulo(ler("tipo_veiculo")),
      pesoGramas,
      imagemUrl: ouNulo(ler("imagem_url")),
    });
  }

  return { linhas, erros };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- csv-import`
Expected: PASS — 6 testes.

- [ ] **Step 5: Escrever o script de importação**

Criar `scripts/import-catalog.ts`:

```ts
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  brands,
  categories,
  productMedia,
  products,
  productVariants,
} from "@/db/schema";
import { parseLinhasCatalogo } from "@/core/catalog/csv-import";

function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function acharOuCriarMarca(nome: string): Promise<string> {
  const slug = slugificar(nome);
  const [existente] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.slug, slug))
    .limit(1);
  if (existente) return existente.id;

  const [criado] = await db
    .insert(brands)
    .values({ name: nome, slug })
    .returning({ id: brands.id });
  return criado.id;
}

async function acharOuCriarCategoria(nome: string): Promise<string> {
  const slug = slugificar(nome);
  const [existente] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  if (existente) return existente.id;

  const [criado] = await db
    .insert(categories)
    .values({ name: nome, slug })
    .returning({ id: categories.id });
  return criado.id;
}

async function main() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error("Uso: npm run import:catalogo -- caminho/do/arquivo.csv");
    process.exit(1);
  }

  const { linhas, erros } = parseLinhasCatalogo(readFileSync(caminho, "utf8"));

  for (const erro of erros) {
    console.error(`Linha ${erro.linha}: ${erro.motivo}`);
  }

  if (linhas.length === 0) {
    console.error("Nenhuma linha válida. Nada foi importado.");
    process.exit(1);
  }

  let variantesCriadas = 0;

  for (const linha of linhas) {
    const brandId = await acharOuCriarMarca(linha.marca);
    const categoryId = await acharOuCriarCategoria(linha.categoria);
    const slugProduto = slugificar(`${linha.marca} ${linha.produto}`);

    let [produto] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slugProduto))
      .limit(1);

    if (!produto) {
      [produto] = await db
        .insert(products)
        .values({
          brandId,
          categoryId,
          name: linha.produto,
          slug: slugProduto,
          description: linha.descricao,
          status: "active",
        })
        .returning({ id: products.id });

      if (linha.imagemUrl) {
        await db.insert(productMedia).values({
          productId: produto.id,
          url: linha.imagemUrl,
          alt: `${linha.marca} ${linha.produto}`,
          position: 0,
        });
      }
    }

    await db
      .insert(productVariants)
      .values({
        productId: produto.id,
        sku: linha.sku,
        ean: linha.ean,
        priceCents: linha.precoCents,
        width: linha.medida?.width ?? null,
        profile: linha.medida?.profile ?? null,
        rim: linha.medida?.rim ?? null,
        loadIndex: linha.medida?.loadIndex ?? null,
        speedRating: linha.medida?.speedRating ?? null,
        vehicleType: linha.tipoVeiculo as "passeio" | "suv" | "carga" | "moto" | null,
        weightGrams: linha.pesoGramas,
        lengthMm: 640,
        widthMm: 640,
        heightMm: 210,
      })
      .onConflictDoUpdate({
        target: productVariants.sku,
        set: { priceCents: linha.precoCents },
      });

    variantesCriadas++;
  }

  console.log(
    `Importadas ${variantesCriadas} variantes. ${erros.length} linhas com erro.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 6: Registrar o script**

```bash
npm install -D tsx
```

Adicionar ao `package.json`:

```json
"import:catalogo": "tsx --env-file=.env.local scripts/import-catalog.ts"
```

- [ ] **Step 7: Documentar o formato para o cliente**

Criar `docs/importacao-catalogo.md`:

```markdown
# Importação de catálogo por CSV

Arquivo em UTF-8, separado por vírgula, com esta primeira linha exata:

marca,categoria,produto,descricao,sku,ean,preco,medida,tipo_veiculo,peso_gramas,imagem_url

| Coluna | Obrigatória | Formato |
|---|---|---|
| marca | sim | Michelin |
| categoria | sim | Pneus |
| produto | sim | Primacy 4 |
| descricao | não | texto livre |
| sku | sim | único no arquivo e no sistema |
| ean | não | código de barras |
| preco | sim | 650.00 ou 1.250,90 |
| medida | não (vazio para acessório) | 205/55 R16 91V |
| tipo_veiculo | não | passeio, suv, carga ou moto |
| peso_gramas | sim | 9000 — necessário para cotar frete |
| imagem_url | não | URL pública da foto |

Campo que contenha vírgula deve vir entre aspas: `"1.250,90"`.

Rodar:

    npm run import:catalogo -- catalogo.csv

Linhas com erro são relatadas com o número da linha e o motivo; as demais
são importadas normalmente. Rodar de novo com o mesmo SKU atualiza o preço.
```

- [ ] **Step 8: Testar com um arquivo real**

Criar `tmp/exemplo.csv` com três linhas e rodar:

Run: `npm run import:catalogo -- tmp/exemplo.csv`
Expected: "Importadas 3 variantes. 0 linhas com erro." e os produtos aparecem em `/pneus`.

- [ ] **Step 9: Commit**

```bash
git add src scripts docs package.json package-lock.json
git commit -m "feat(catalogo): importacao por CSV com relatorio de erro por linha"
```

---

### Task 11: Layout da loja e publicação em produção

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/layout/cabecalho.tsx`, `src/components/layout/rodape.tsx`, `src/components/catalogo/busca.tsx`
- Create: `src/app/(loja)/page.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: tudo das tarefas anteriores
- Produces: site publicado com domínio e SSL; CI rodando teste, lint e build

- [ ] **Step 1: Escrever a busca**

Criar `src/components/catalogo/busca.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Busca({ inicial = "" }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  const router = useRouter();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const termo = valor.trim();
    router.push(termo ? `/pneus?q=${encodeURIComponent(termo)}` : "/pneus");
  }

  return (
    <form onSubmit={enviar} role="search" className="flex w-full max-w-lg gap-2">
      <input
        type="search"
        name="q"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Busque pela medida, ex: 205/55 R16"
        aria-label="Buscar pneus"
        className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-neutral-900 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
      >
        Buscar
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Escrever cabeçalho e rodapé**

Criar `src/components/layout/cabecalho.tsx`:

```tsx
import Link from "next/link";
import { Busca } from "@/components/catalogo/busca";
import { WhatsAppLink } from "@/components/whatsapp-link";

export function Cabecalho() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
        <Link href="/" className="text-xl font-bold text-neutral-900">
          Zé Pneu
        </Link>
        <div className="order-3 w-full md:order-none md:flex-1">
          <Busca />
        </div>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/pneus" className="text-neutral-700 hover:text-neutral-900">
            Pneus
          </Link>
          <WhatsAppLink
            mensagem="Olá! Vim pelo site do Zé Pneu."
            className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
          >
            WhatsApp
          </WhatsAppLink>
        </nav>
      </div>
    </header>
  );
}
```

Criar `src/components/layout/rodape.tsx`:

```tsx
export function Rodape() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-900">Zé Pneu</p>
        <p className="mt-1">
          Pneus e acessórios com entrega em todo o Brasil e retirada em Brasília.
        </p>
        <p className="mt-4 text-xs text-neutral-500">
          © {new Date().getFullYear()} Zé Pneu. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Montar o layout raiz**

Substituir `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Cabecalho } from "@/components/layout/cabecalho";
import { Rodape } from "@/components/layout/rodape";

export const metadata: Metadata = {
  title: {
    default: "Zé Pneu — Pneus e acessórios automotivos",
    template: "%s | Zé Pneu",
  },
  description:
    "Pneus de todas as medidas e marcas, com entrega em todo o Brasil e retirada em Brasília.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased">
        <Cabecalho />
        <div className="flex-1">{children}</div>
        <Rodape />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Escrever a home**

Criar `src/app/(loja)/page.tsx` e apagar `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { getCatalogService } from "@/lib/container";
import { ProductCard } from "@/components/produto/product-card";

export default async function HomePage() {
  const { items } = await getCatalogService().listar({ page: 1, perPage: 8 });

  return (
    <main>
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-neutral-900 sm:text-5xl">
            O pneu certo, sem complicação
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600">
            Busque pela medida do seu pneu, compare marcas e receba em casa — ou
            retire em Brasília.
          </p>
          <Link
            href="/pneus"
            className="mt-8 inline-block rounded-lg bg-neutral-900 px-8 py-3 font-semibold text-white hover:bg-neutral-700"
          >
            Ver todos os pneus
          </Link>
        </div>
      </section>

      {items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="text-2xl font-bold text-neutral-900">Destaques</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((produto) => (
              <ProductCard key={produto.id} produto={produto} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Escrever sitemap e robots**

Criar `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { getCatalogService } from "@/lib/container";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { items } = await getCatalogService().listar({ page: 1, perPage: 96 });

  return [
    { url: base, priority: 1 },
    { url: `${base}/pneus`, priority: 0.9 },
    ...items.map((p) => ({
      url: `${base}/produto/${p.slug}`,
      priority: 0.8,
    })),
  ];
}
```

Criar `src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

- [ ] **Step 6: Escrever o CI**

Criar `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verificar:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: zepneu_test
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
        ports: ["5432:5432"]
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/zepneu_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 7: Verificar tudo localmente**

Run: `npm test && npm run lint && npm run build`
Expected: PASS nos três.

- [ ] **Step 8: Publicar**

1. Criar um projeto Supabase `ze-pneu-prod` e aplicar as migrações.
2. Importar o catálogo real por CSV.
3. Criar o projeto na Vercel a partir do repositório.
4. Configurar `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` e `NEXT_PUBLIC_WHATSAPP_NUMERO` como variáveis de ambiente de produção.
5. Apontar o domínio e confirmar o SSL.

Expected: `/`, `/pneus` e uma página de produto abrem no domínio de produção, e `/sitemap.xml` lista os produtos.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(loja): layout, home, SEO e pipeline de CI"
```

---

## Estado ao fim do Plano 1

O site está no ar: catálogo importado, navegável por marca e medida, com busca que entende "205/55 R16", páginas de produto indexáveis e botão de WhatsApp. O botão de carrinho existe e está desabilitado — é o ponto de partida do Plano 2.

**Plano 2 (Estoque, Carrinho e Pedido)** começa pelo livro-razão de estoque e pelo teste de duas reservas concorrentes do último item, que é a regra que sustenta a seção 2.2 da spec.

---

## Desvios registrados durante a execução

O plano foi escrito antes de tocar no ambiente real. Estes pontos mudaram na
execução, todos verificados:

| Plano dizia | Ficou | Motivo |
|---|---|---|
| Next.js 15 | **Next.js 16.3.4** | É o estável atual. O código do plano já usava `params`/`searchParams` como `Promise`, contrato de 15 e 16 — nada quebrou. |
| `@types/node@^20` | **`^22`** | Vitest 5 exige `^22 \|\| >=24`, e o runtime real é Node 22. O tipo é que estava desalinhado; `--legacy-peer-deps` teria escondido isso. |
| `eslint.config.mjs` com `FlatCompat` | `defineConfig` de `eslint/config` | Formato do Next 16. A regra de fronteira foi adaptada e ampliada: o núcleo também não pode importar `drizzle-orm`, `postgres` nem `@/db/*`. |
| `vite-tsconfig-paths` | Removido | Vite 8 resolve paths do tsconfig nativamente (`resolve.tsconfigPaths`). Uma dependência a menos. |
| Supabase para desenvolvimento | **Postgres em Docker** | Mesma imagem `postgres:16` do CI, sem tocar na conta do cliente e sem latência de rede nos testes. Supabase entra só em produção. |
| `unique("variants_sku_unique")` além do `.unique()` na coluna | Só o `.unique()` | Os dois juntos criariam constraints duplicadas. |
| Ordem 8 → 9 → 10 | **10 → 8 → 9** | Importar o catálogo antes das telas fez as páginas nascerem verificadas contra dado real, em vez de mock. |

### Correções que só apareceram ao abrir o navegador

1. **Modo escuro quebrava o site.** O `globals.css` do scaffold trocava
   `--background` por quase-preto sob `prefers-color-scheme: dark`. Como
   `body { background: ... }` não está em nenhuma layer, vencia os utilitários
   do Tailwind: seção preta com texto preto. A loja agora tem paleta clara
   explícita e única.

2. **Filtros enterravam os produtos no celular.** Cinco grupos de faceta
   abertos empurravam o primeiro pneu dezenas de linhas abaixo. Virou painel
   recolhível com contador de filtros ativos, expandido por padrão no desktop.

3. **Home e sitemap congelados no build.** Ambos eram estáticos e o catálogo
   muda por importação de CSV, não por deploy — produto novo não apareceria.
   Revalidação de 5 minutos.

### Pendente nesta etapa

Só o **Step 8 da Task 11**: publicação em produção (projeto Supabase de
produção, projeto na Vercel, variáveis de ambiente, domínio e SSL). Depende de
credenciais e do domínio do cliente.
