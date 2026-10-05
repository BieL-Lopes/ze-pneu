import type {
  OpcaoDeFrete,
  ShippingProvider,
} from "@/core/shipping/shipping-provider";
import { ok, err } from "@/core/shared/result";

const ENDERECOS = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  producao: "https://melhorenvio.com.br",
} as const;

const TEMPO_LIMITE_MS = 10_000;

const INDISPONIVEL =
  "Não conseguimos cotar a entrega agora. Escolha a retirada em Brasília ou fale com a gente no WhatsApp.";

type ServicoCotado = {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: { name?: string };
};

/** mm para cm, arredondando para cima: caixa declarada menor é cobrada a mais na entrega. */
function cm(mm: number): number {
  return Math.ceil(mm / 10);
}

/**
 * Adaptador do Melhor Envio. Só cota: a etiqueta, por enquanto, a operação
 * compra no painel do Melhor Envio.
 */
export function createMelhorEnvioProvider(config: {
  token: string;
  ambiente: keyof typeof ENDERECOS;
  cepOrigem: string;
  /** Contato que a API exige no User-Agent. */
  email: string;
  fetch?: typeof globalThis.fetch;
}): ShippingProvider {
  const fetch = config.fetch ?? globalThis.fetch;

  return {
    async cotar({ cepDestino, pacotes }) {
      let resposta: Response;
      try {
        resposta = await fetch(`${ENDERECOS[config.ambiente]}/api/v2/me/shipment/calculate`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.token}`,
            "User-Agent": `Ze Pneu (${config.email})`,
          },
          body: JSON.stringify({
            from: { postal_code: config.cepOrigem },
            to: { postal_code: cepDestino },
            products: pacotes.map((p) => ({
              id: p.sku,
              width: cm(p.widthMm),
              height: cm(p.heightMm),
              length: cm(p.lengthMm),
              weight: p.pesoGramas / 1000,
              insurance_value: p.valorCents / 100,
              quantity: p.quantidade,
            })),
            options: { receipt: false, own_hand: false },
          }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
      } catch (e) {
        console.error("Melhor Envio inacessível", e);
        return err(INDISPONIVEL);
      }

      if (!resposta.ok) {
        console.error(`Melhor Envio respondeu ${resposta.status}: ${await resposta.text()}`);
        return err(INDISPONIVEL);
      }

      const servicos = (await resposta.json()) as ServicoCotado[];
      const opcoes: OpcaoDeFrete[] = servicos
        // Serviço que não atende (pneu acima do limite de tamanho, CEP fora da
        // área) volta com `error` em vez de preço.
        .filter((s) => !s.error && (s.custom_price ?? s.price) !== undefined)
        .map((s) => ({
          id: String(s.id),
          servico: s.name,
          transportadora: s.company?.name ?? s.name,
          // O preço e o prazo "custom" já incluem os ajustes da conta da loja.
          prazoDias: s.custom_delivery_time ?? s.delivery_time ?? 0,
          precoCents: Math.round(Number(s.custom_price ?? s.price) * 100),
        }))
        .filter((o) => Number.isFinite(o.precoCents) && o.precoCents > 0)
        .sort((a, b) => a.precoCents - b.precoCents);

      if (opcoes.length === 0) {
        return err(
          "Nenhuma transportadora atende esse CEP para esses pneus. Escolha a retirada em Brasília ou fale com a gente no WhatsApp.",
        );
      }
      return ok(opcoes);
    },
  };
}
