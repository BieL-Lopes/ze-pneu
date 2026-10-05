import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { siteSettings, stockLocations } from "@/db/schema";
import { createDrizzleProductRepository } from "@/db/repositories/drizzle-product-repository";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";
import { createDrizzleCartRepository } from "@/db/repositories/drizzle-cart-repository";
import { createDrizzleOrderRepository } from "@/db/repositories/drizzle-order-repository";
import { createCatalogService } from "@/core/catalog/catalog-service";
import { createCheckoutService } from "@/core/orders/checkout-service";
import { createConfirmacaoDePagamento } from "@/core/orders/confirmacao-pagamento";
import type { PaymentProvider } from "@/core/payment/payment-provider";
import type { ShippingProvider } from "@/core/shipping/shipping-provider";
import { normalizarCep } from "@/core/shipping/cep";
import { createMercadoPagoProvider } from "@/integrations/mercado-pago";
import { createMelhorEnvioProvider } from "@/integrations/melhor-envio";
import { siteUrl } from "@/lib/site-url";

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

/** Variável configurada de verdade: vazia ou só espaços conta como ausente. */
function env(nome: string): string | undefined {
  const valor = process.env[nome]?.trim();
  return valor ? valor : undefined;
}

/**
 * Pagamento, ou null sem credencial.
 *
 * Sem credencial a loja continua no ar: o checkout mostra que o pagamento
 * online está indisponível e aponta para o WhatsApp, em vez de quebrar.
 */
export function getPaymentProvider(): PaymentProvider | null {
  const accessToken = env("MERCADO_PAGO_ACCESS_TOKEN");
  return accessToken ? createMercadoPagoProvider({ accessToken }) : null;
}

/** Cotação de frete, ou null sem configuração completa: só a retirada fica. */
export function getShippingProvider(): ShippingProvider | null {
  const token = env("MELHOR_ENVIO_TOKEN");
  const cepOrigem = normalizarCep(env("MELHOR_ENVIO_CEP_ORIGEM") ?? "");
  const email = env("MELHOR_ENVIO_EMAIL");
  if (!token || !cepOrigem || !email) return null;

  return createMelhorEnvioProvider({
    token,
    cepOrigem,
    email,
    ambiente: env("MELHOR_ENVIO_AMBIENTE") === "producao" ? "producao" : "sandbox",
  });
}

export function getOrderRepository() {
  return createDrizzleOrderRepository(db);
}

export async function getCheckoutService() {
  const base = siteUrl();
  return createCheckoutService({
    carrinhos: await getCartRepository(),
    estoque: await getStockRepository(),
    pedidos: getOrderRepository(),
    frete: getShippingProvider(),
    pagamento: getPaymentProvider(),
    urls: {
      retorno: (ref, token) =>
        new URL(`/pedido/${ref}?t=${encodeURIComponent(token)}`, base).toString(),
      // `source_news=webhooks` pede só o formato novo, que vem assinado. Sem
      // isso o Mercado Pago também manda o IPN antigo, que não tem assinatura.
      notificacao: new URL("/api/webhooks/mercado-pago?source_news=webhooks", base).toString(),
    },
  });
}

export async function getConfirmacaoDePagamento() {
  const pagamento = getPaymentProvider();
  if (!pagamento) return null;
  return createConfirmacaoDePagamento({
    pedidos: getOrderRepository(),
    estoque: await getStockRepository(),
    carrinhos: await getCartRepository(),
    pagamento,
  });
}
