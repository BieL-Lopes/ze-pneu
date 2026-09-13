import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { siteSettings, stockLocations } from "@/db/schema";
import { createDrizzleProductRepository } from "@/db/repositories/drizzle-product-repository";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";
import { createDrizzleCartRepository } from "@/db/repositories/drizzle-cart-repository";
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

/**
 * Lê configurações editáveis do site.
 *
 * Devolve apenas as chaves ligadas: uma configuração desligada equivale a
 * ausente, então quem consome só precisa tratar o caso "não tem".
 */
export async function getConfiguracoes(
  chaves: string[],
): Promise<Record<string, string | null>> {
  if (chaves.length === 0) return {};

  try {
    const linhas = await db
      .select({
        key: siteSettings.key,
        value: siteSettings.value,
        enabled: siteSettings.enabled,
      })
      .from(siteSettings)
      .where(inArray(siteSettings.key, chaves));

    return Object.fromEntries(
      linhas.filter((l) => l.enabled).map((l) => [l.key, l.value]),
    );
  } catch (erro) {
    // Configuração é enfeite: se a leitura falhar, a loja continua vendendo.
    console.error("Falha ao ler configurações do site", erro);
    return {};
  }
}

/**
 * Local de estoque padrão.
 *
 * Na Fase 1 existe um só, em Brasília. Resolvido uma vez e memorizado — a
 * consulta é a mesma em toda requisição e o id não muda.
 */
let localIdCache: string | null = null;

export async function getLocalPadraoId(): Promise<string> {
  if (localIdCache) return localIdCache;

  const [local] = await db
    .select({ id: stockLocations.id })
    .from(stockLocations)
    .where(eq(stockLocations.slug, "brasilia"))
    .limit(1);

  if (!local) {
    throw new Error(
      'Local de estoque "brasilia" não cadastrado. A migração de estoque não foi aplicada.',
    );
  }

  localIdCache = local.id;
  return local.id;
}

export async function getStockRepository() {
  return createDrizzleStockRepository(db, await getLocalPadraoId());
}

export async function getCartRepository() {
  return createDrizzleCartRepository(db, await getStockRepository());
}
