import { and, eq, like, max, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { productMedia, products, productVariants } from "@/db/schema";
import { dimensoesDaCaixa } from "@/core/catalog/dimensoes";
import type { ProdutoValido, VarianteValida } from "@/core/catalog/cadastro";
import { type Result, ok, err } from "@/core/shared/result";
import { acharOuCriarCategoria, acharOuCriarMarca, slugificar } from "./importar-catalogo";

/**
 * Escritas do cadastro de produtos feitas pelo painel. A validação já
 * aconteceu no núcleo (`core/catalog/cadastro`); aqui só se grava.
 */

async function slugLivre(base: string): Promise<string> {
  const usados = new Set(
    (
      await db
        .select({ slug: products.slug })
        .from(products)
        .where(like(products.slug, `${base}%`))
    ).map((l) => l.slug),
  );
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) if (!usados.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function criarProduto(dados: ProdutoValido): Promise<string> {
  const [brandId, categoryId] = await Promise.all([
    acharOuCriarMarca(db, dados.marca),
    acharOuCriarCategoria(db, dados.categoria),
  ]);
  const [criado] = await db
    .insert(products)
    .values({
      brandId,
      categoryId,
      name: dados.nome,
      slug: await slugLivre(slugificar(`${dados.marca} ${dados.nome}`)),
      description: dados.descricao,
      status: dados.status,
    })
    .returning({ id: products.id });
  return criado.id;
}

/** O endereço (slug) não muda ao renomear: link já indexado no Google continua valendo. */
export async function atualizarProduto(id: string, dados: ProdutoValido): Promise<void> {
  const [brandId, categoryId] = await Promise.all([
    acharOuCriarMarca(db, dados.marca),
    acharOuCriarCategoria(db, dados.categoria),
  ]);
  await db
    .update(products)
    .set({
      brandId,
      categoryId,
      name: dados.nome,
      description: dados.descricao,
      status: dados.status,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));
}

export async function adicionarVariante(productId: string, v: VarianteValida): Promise<Result<void>> {
  const [existente] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.sku, v.sku))
    .limit(1);
  if (existente) return err(`O SKU ${v.sku} já existe.`);

  const caixa = v.medida ? dimensoesDaCaixa(v.medida) : { lengthMm: 640, widthMm: 640, heightMm: 210 };
  await db.insert(productVariants).values({
    productId,
    sku: v.sku,
    ean: v.ean,
    priceCents: v.precoCents,
    width: v.medida?.width ?? null,
    profile: v.medida?.profile ?? null,
    rim: v.medida?.rim ?? null,
    loadIndex: v.medida?.loadIndex ?? null,
    speedRating: v.medida?.speedRating ?? null,
    vehicleType: v.tipoVeiculo,
    weightGrams: v.pesoGramas,
    ...caixa,
  });
  return ok(undefined);
}

export async function atualizarVariante(
  productId: string,
  variantId: string,
  dados: { precoCents: number; pesoGramas: number; ativa: boolean },
): Promise<void> {
  await db
    .update(productVariants)
    .set({
      priceCents: dados.precoCents,
      weightGrams: dados.pesoGramas,
      status: dados.ativa ? "active" : "archived",
    })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
}

export async function adicionarFoto(productId: string, url: string, alt: string): Promise<void> {
  const [{ ultima }] = await db
    .select({ ultima: max(productMedia.position) })
    .from(productMedia)
    .where(eq(productMedia.productId, productId));
  await db.insert(productMedia).values({ productId, url, alt, position: (ultima ?? -1) + 1 });
}

export async function removerFoto(productId: string, fotoId: string): Promise<void> {
  await db.delete(productMedia).where(and(eq(productMedia.id, fotoId), eq(productMedia.productId, productId)));
}

/** A primeira foto é a da vitrine. Passa esta para a frente das outras. */
export async function tornarFotoPrincipal(productId: string, fotoId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(productMedia)
      .set({ position: sql`${productMedia.position} + 1` })
      .where(eq(productMedia.productId, productId));
    await tx
      .update(productMedia)
      .set({ position: 0 })
      .where(and(eq(productMedia.id, fotoId), eq(productMedia.productId, productId)));
  });
}
