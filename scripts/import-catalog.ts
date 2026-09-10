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

type TipoVeiculo = "passeio" | "suv" | "carga" | "moto";
const TIPOS_VALIDOS: TipoVeiculo[] = ["passeio", "suv", "carga", "moto"];

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

function tipoVeiculo(bruto: string | null): TipoVeiculo | null {
  if (bruto === null) return null;
  const normalizado = bruto.toLowerCase() as TipoVeiculo;
  return TIPOS_VALIDOS.includes(normalizado) ? normalizado : null;
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

  let variantes = 0;

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

    // Reimportar o mesmo SKU atualiza o preço em vez de falhar — é assim que o
    // cliente faz reajuste de tabela: reexporta a planilha inteira e roda de novo.
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
        lengthMm: 640,
        widthMm: 640,
        heightMm: 210,
      })
      .onConflictDoUpdate({
        target: productVariants.sku,
        set: { priceCents: linha.precoCents },
      });

    variantes++;
  }

  console.log(
    `Importadas ${variantes} variantes. ${erros.length} linhas com erro.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
