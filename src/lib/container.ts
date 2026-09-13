import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
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
