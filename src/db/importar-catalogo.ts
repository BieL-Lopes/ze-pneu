import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  brands,
  categories,
  productMedia,
  products,
  productVariants,
} from "@/db/schema";
import { parseLinhasCatalogo, type ErroImportacao } from "@/core/catalog/csv-import";
import { dimensoesDaCaixa } from "@/core/catalog/dimensoes";

type TipoVeiculo = "passeio" | "suv" | "carga" | "moto";
const TIPOS_VALIDOS: TipoVeiculo[] = ["passeio", "suv", "carga", "moto"];

export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function acharOuCriarMarca(db: Database, nome: string): Promise<string> {
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

export async function acharOuCriarCategoria(db: Database, nome: string): Promise<string> {
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

export function tipoVeiculo(bruto: string | null): TipoVeiculo | null {
  if (bruto === null) return null;
  const normalizado = bruto.toLowerCase() as TipoVeiculo;
  return TIPOS_VALIDOS.includes(normalizado) ? normalizado : null;
}

/**
 * Importa o catálogo de um CSV. Usado pelo script de linha de comando e pela
 * tela de importação do painel — o mesmo código, para que a planilha se
 * comporte igual nos dois caminhos.
 *
 * Reimportar o mesmo SKU atualiza preço e peso em vez de falhar.
 */
export async function importarCatalogo(
  db: Database,
  csv: string,
): Promise<{ variantes: number; produtosNovos: number; erros: ErroImportacao[] }> {
  const { linhas, erros } = parseLinhasCatalogo(csv);
  let produtosNovos = 0;

  let variantes = 0;

  for (const linha of linhas) {
    const brandId = await acharOuCriarMarca(db, linha.marca);
    const categoryId = await acharOuCriarCategoria(db, linha.categoria);
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
      produtosNovos++;

      if (linha.imagemUrl) {
        await db.insert(productMedia).values({
          productId: produto.id,
          url: linha.imagemUrl,
          alt: `${linha.marca} ${linha.produto}`,
          position: 0,
        });
      }
    }

    // Caixa pela medida: o frete cobra pelo volume, e uma caixa única fazia o
    // aro 13 e o aro 24 custarem o mesmo. Acessório sem medida fica com a
    // caixa padrão.
    const caixa = linha.medida
      ? dimensoesDaCaixa(linha.medida)
      : { lengthMm: 640, widthMm: 640, heightMm: 210 };

    // Reimportar o mesmo SKU atualiza preço e peso em vez de falhar — é assim
    // que o cliente faz reajuste de tabela: reexporta a planilha inteira e roda
    // de novo. O peso entra junto porque a primeira carga pode vir com peso
    // estimado, a ser trocado pelo real antes do frete entrar no ar.
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
        vehicleType: tipoVeiculo(linha.tipoVeiculo),
        weightGrams: linha.pesoGramas,
        ...caixa,
      })
      .onConflictDoUpdate({
        target: productVariants.sku,
        set: { priceCents: linha.precoCents, weightGrams: linha.pesoGramas, ...caixa },
      });

    variantes++;
  }

  return { variantes, produtosNovos, erros };
}
