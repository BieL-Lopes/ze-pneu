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

type VehicleType = "passeio" | "suv" | "carga" | "moto";

const ROTULO_TIPO: Record<VehicleType, string> = {
  passeio: "Passeio",
  suv: "SUV",
  carga: "Carga",
  moto: "Moto",
};

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

function contar(
  valores: (string | null)[],
  rotular: (valor: string) => string = (v) => v,
): FacetCount[] {
  const mapa = new Map<string, number>();
  for (const v of valores) {
    if (v === null) continue;
    mapa.set(v, (mapa.get(v) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([value, count]) => ({ value, label: rotular(value), count }))
    .sort((a, b) => a.value.localeCompare(b.value, "pt-BR", { numeric: true }));
}

export function createDrizzleProductRepository(db: Database): ProductRepository {
  /**
   * Uma linha por variante que casa com o filtro. As facetas são contadas
   * sobre este mesmo conjunto, então o número ao lado de cada opção reflete
   * exatamente o que o cliente vai encontrar ao clicar nela.
   */
  async function linhasFiltradas(f: CatalogFilters) {
    const condicoes = [
      eq(products.status, "active"),
      eq(productVariants.status, "active"),
    ];

    if (f.brandSlugs?.length) condicoes.push(inArray(brands.slug, f.brandSlugs));
    if (f.widths?.length)
      condicoes.push(inArray(productVariants.width, f.widths));
    if (f.profiles?.length)
      condicoes.push(inArray(productVariants.profile, f.profiles));
    if (f.rims?.length) condicoes.push(inArray(productVariants.rim, f.rims));
    if (f.vehicleTypes?.length)
      condicoes.push(
        inArray(productVariants.vehicleType, f.vehicleTypes as VehicleType[]),
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
        if (!capa.has(m.productId))
          capa.set(m.productId, { url: m.url, alt: m.alt });
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
          vehicleTypes: contar(
            linhas.map((l) => l.vehicleType),
            (v) => ROTULO_TIPO[v as VehicleType] ?? v,
          ),
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
