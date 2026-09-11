import type { ProductRepository } from "./product-repository";
import type { CatalogFilters, ProductDetail, SearchResult } from "./types";
import { parseTireSize } from "./tire-size";

/**
 * Quando a busca textual é na verdade uma medida ("205/55 R16"), converte em
 * filtro estruturado — senão o cliente digitaria a medida certa e receberia
 * zero resultados, porque a medida não está no nome do produto.
 *
 * Filtro já escolhido nas facetas tem precedência: a busca não pode desfazer
 * o que o cliente clicou.
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
