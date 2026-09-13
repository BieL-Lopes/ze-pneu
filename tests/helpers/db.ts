import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL_TEST;
if (!url) {
  throw new Error(
    "DATABASE_URL_TEST não configurada. Os testes truncam tabelas, então " +
      "exigem um destino próprio.",
  );
}

/**
 * Schema onde os testes rodam.
 *
 * Os testes truncam tabelas a cada execução. Isolá-los em um schema separado
 * permite usar a mesma instância Postgres de produção sem risco: o TRUNCATE
 * atinge teste.products e nunca public.products.
 */
const TEST_SCHEMA = process.env.TEST_SCHEMA ?? "teste";

/**
 * Trava de segurança.
 *
 * Um erro de configuração aqui apaga o catálogo e os pedidos reais. A checagem
 * existe para que isso seja impossível, e não apenas desaconselhado — nenhum
 * comentário em arquivo de exemplo impede um copiar e colar distraído.
 */
if (TEST_SCHEMA === "public") {
  throw new Error(
    'TEST_SCHEMA não pode ser "public": os testes truncam as tabelas e ' +
      "apagariam os dados reais. Use um schema dedicado, como \"teste\".",
  );
}

const client = postgres(url, {
  prepare: false,
  max: 5,
  connection: { search_path: TEST_SCHEMA },
});

export const testDb = drizzle(client, { schema });

/** Confirma, contra o banco, em que schema os testes estão de fato escrevendo. */
export async function schemaEmUso(): Promise<string> {
  const linhas = await testDb.execute<{ atual: string }>(
    sql`SELECT current_schema() AS atual`,
  );
  return (linhas as unknown as { atual: string }[])[0].atual;
}

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
      vehicleType: "passeio" as const,
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
      vehicleType: "passeio" as const,
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
      vehicleType: "passeio" as const,
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
