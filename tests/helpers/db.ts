import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, inArray, like } from "drizzle-orm";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL_TEST ou DATABASE_URL necessária");
}

const client = postgres(url, { prepare: false, max: 5 });
export const testDb = drizzle(client, { schema });

/**
 * Prefixo que marca tudo que a suíte cria.
 *
 * Os testes convivem com os dados reais no mesmo banco. Em vez de truncar
 * tabelas — que apagaria o catálogo e os pedidos do cliente — cada execução
 * cria registros marcados e remove exatamente esses no fim. Nada fora do
 * prefixo é tocado em nenhum momento.
 */
export const PREFIXO = "zztest";

let contador = 0;

/** Identificador único por execução, para duas suítes simultâneas não colidirem. */
export function idDeTeste(): string {
  contador += 1;
  return `${PREFIXO}-${process.pid}-${Date.now()}-${contador}`;
}

/**
 * Remove tudo que a suíte criou, e somente isso.
 *
 * A ordem respeita as chaves estrangeiras: movimentos e reservas antes dos
 * saldos, itens antes dos pedidos, variantes antes dos produtos.
 */
export async function limparDadosDeTeste() {
  const produtos = await testDb
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(like(schema.products.slug, `${PREFIXO}%`));
  const produtoIds = produtos.map((p) => p.id);

  const variantes = produtoIds.length
    ? await testDb
        .select({ id: schema.productVariants.id })
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.productId, produtoIds))
    : [];
  const varianteIds = variantes.map((v) => v.id);

  const pedidos = await testDb
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(like(schema.orders.reference, `${PREFIXO}%`));
  const pedidoIds = pedidos.map((p) => p.id);

  if (pedidoIds.length) {
    await testDb
      .delete(schema.orderEvents)
      .where(inArray(schema.orderEvents.orderId, pedidoIds));
    await testDb
      .delete(schema.orderItems)
      .where(inArray(schema.orderItems.orderId, pedidoIds));
    await testDb
      .delete(schema.orders)
      .where(inArray(schema.orders.id, pedidoIds));
  }

  if (varianteIds.length) {
    await testDb
      .delete(schema.stockReservations)
      .where(inArray(schema.stockReservations.variantId, varianteIds));
    await testDb
      .delete(schema.stockMovements)
      .where(inArray(schema.stockMovements.variantId, varianteIds));
    await testDb
      .delete(schema.stockBalances)
      .where(inArray(schema.stockBalances.variantId, varianteIds));
    await testDb
      .delete(schema.cartItems)
      .where(inArray(schema.cartItems.variantId, varianteIds));
  }

  await testDb
    .delete(schema.carts)
    .where(like(schema.carts.token, `${PREFIXO}%`));

  if (produtoIds.length) {
    await testDb
      .delete(schema.products)
      .where(inArray(schema.products.id, produtoIds));
  }

  await testDb
    .delete(schema.categories)
    .where(like(schema.categories.slug, `${PREFIXO}%`));
  await testDb
    .delete(schema.brands)
    .where(like(schema.brands.slug, `${PREFIXO}%`));
}

export type CatalogoDeTeste = Awaited<ReturnType<typeof semearCatalogo>>;

/**
 * Cria um catálogo isolado para um teste.
 *
 * Devolve os slugs gerados porque eles mudam a cada execução: o teste precisa
 * consultar por eles em vez de por um valor fixo.
 */
export async function semearCatalogo() {
  const id = idDeTeste();

  const [marca] = await testDb
    .insert(schema.brands)
    .values({ name: `Michelin ${id}`, slug: `${id}-michelin` })
    .returning();
  const [outraMarca] = await testDb
    .insert(schema.brands)
    .values({ name: `Pirelli ${id}`, slug: `${id}-pirelli` })
    .returning();
  const [categoria] = await testDb
    .insert(schema.categories)
    .values({ name: `Pneus ${id}`, slug: `${id}-pneus` })
    .returning();

  const [primacy] = await testDb
    .insert(schema.products)
    .values({
      brandId: marca.id,
      categoryId: categoria.id,
      name: "Primacy 4",
      slug: `${id}-michelin-primacy-4`,
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
      slug: `${id}-pirelli-cinturato-p7`,
      status: "active",
    })
    .returning();

  const dimensoes = {
    weightGrams: 9000,
    lengthMm: 640,
    widthMm: 640,
    heightMm: 210,
  };

  const variantes = await testDb
    .insert(schema.productVariants)
    .values([
      {
        productId: primacy.id,
        sku: `${id}-MICH-2055516`,
        priceCents: 65000,
        width: 205,
        profile: 55,
        rim: 16,
        loadIndex: 91,
        speedRating: "V",
        vehicleType: "passeio" as const,
        ...dimensoes,
      },
      {
        productId: primacy.id,
        sku: `${id}-MICH-1957515`,
        priceCents: 52000,
        width: 195,
        profile: 75,
        rim: 15,
        loadIndex: 88,
        speedRating: "H",
        vehicleType: "passeio" as const,
        ...dimensoes,
      },
      {
        productId: cinturato.id,
        sku: `${id}-PIRE-2055516`,
        priceCents: 58000,
        width: 205,
        profile: 55,
        rim: 16,
        loadIndex: 91,
        speedRating: "W",
        vehicleType: "passeio" as const,
        ...dimensoes,
      },
    ])
    .returning();

  await testDb.insert(schema.productMedia).values({
    productId: primacy.id,
    url: "https://exemplo.test/primacy.jpg",
    alt: "Michelin Primacy 4",
    position: 0,
  });

  return {
    id,
    marca,
    outraMarca,
    categoria,
    primacy,
    cinturato,
    /** Variantes na ordem em que foram criadas. */
    variantes,
    /** Slugs gerados, para o teste consultar sem depender de valor fixo. */
    slugs: {
      primacy: primacy.slug,
      cinturato: cinturato.slug,
      marca: marca.slug,
      outraMarca: outraMarca.slug,
    },
  };
}

/** Local de estoque de Brasília, criado pela migração. */
export async function localPadrao() {
  const [local] = await testDb
    .select()
    .from(schema.stockLocations)
    .where(eq(schema.stockLocations.slug, "brasilia"))
    .limit(1);

  if (!local) {
    throw new Error(
      'Local de estoque "brasilia" não existe. A migração de estoque não foi aplicada.',
    );
  }
  return local;
}
