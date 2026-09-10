import { db } from "@/db/client";
import { createDrizzleProductRepository } from "@/db/repositories/drizzle-product-repository";
import { createCatalogService } from "@/core/catalog/catalog-service";

/**
 * Ponto único onde o domínio é ligado à infraestrutura.
 *
 * As páginas e rotas pedem o serviço aqui em vez de construir repositórios,
 * então trocar a implementação da porta acontece num arquivo só.
 */
let catalogo: ReturnType<typeof createCatalogService> | null = null;

export function getCatalogService() {
  catalogo ??= createCatalogService(createDrizzleProductRepository(db));
  return catalogo;
}
