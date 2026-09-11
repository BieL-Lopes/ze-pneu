import type { CatalogFilters, ProductDetail, SearchResult } from "./types";

/**
 * Porta de acesso ao catálogo.
 *
 * O núcleo depende desta interface, nunca do Drizzle. É o que permite testar
 * o serviço de catálogo sem banco e, mais tarde, trocar a fonte dos produtos
 * (um ERP, por exemplo) sem tocar em nada acima.
 */
export interface ProductRepository {
  search(filters: CatalogFilters): Promise<SearchResult>;
  findBySlug(slug: string): Promise<ProductDetail | null>;
}
