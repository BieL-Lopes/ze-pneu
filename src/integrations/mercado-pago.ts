import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Pagamento,
  PaymentProvider,
  StatusDePagamento,
} from "@/core/payment/payment-provider";
import { ok, err } from "@/core/shared/result";

const API = "https://api.mercadopago.com";
const TEMPO_LIMITE_MS = 15_000;

type Fetch = typeof globalThis.fetch;

const STATUS: Record<string, StatusDePagamento> = {
  approved: "aprovado",
  authorized: "pendente",
  pending: "pendente",
  in_process: "pendente",
  in_mediation: "pendente",
  rejected: "recusado",
  cancelled: "recusado",
  refunded: "estornado",
  charged_back: "estornado",
};

function reais(cents: number): number {
  return Math.round(cents) / 100;
}

async function mensagemDeErro(resposta: Response): Promise<string> {
  try {
    const corpo = (await resposta.json()) as { message?: string };
    return corpo.message ?? `HTTP ${resposta.status}`;
  } catch {
    return `HTTP ${resposta.status}`;
  }
}

/**
 * Adaptador do Mercado Pago, modalidade Checkout Pro: o cliente paga na página
 * do Mercado Pago e volta. Fala direto com a API REST — o SDK não traria nada
 * além de uma dependência a mais.
 */
export function createMercadoPagoProvider(config: {
  accessToken: string;
  fetch?: Fetch;
}): PaymentProvider {
  const fetch = config.fetch ?? globalThis.fetch;
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
  };
  // Credencial de teste paga no sandbox; a de produção, no endereço real.
  const sandbox = config.accessToken.startsWith("TEST-");

  return {
    nome: "mercado_pago",

    async criarCobranca(c) {
      const expiracao = c.expiraEm.toISOString();
      const itens = c.itens.map((i) => ({
        id: i.sku,
        title: i.titulo,
        quantity: i.quantidade,
        unit_price: reais(i.precoUnitarioCents),
        currency_id: "BRL",
      }));
      // Frete entra como item, e não em `shipments.cost`: assim o valor do
      // pagamento é a soma dos itens, e a confirmação compara com o total do
      // pedido sem depender de como o provedor soma o envio.
      if (c.freteCents > 0) {
        itens.push({ id: "frete", title: "Frete", quantity: 1, unit_price: reais(c.freteCents), currency_id: "BRL" });
      }

      const corpo = {
        items: itens,
        payer: {
          name: c.comprador.nome,
          email: c.comprador.email,
          phone: { area_code: c.comprador.telefone.slice(0, 2), number: c.comprador.telefone.slice(2) },
          identification: { type: "CPF", number: c.comprador.cpf },
        },
        external_reference: c.orderRef,
        notification_url: c.urlNotificacao,
        back_urls: { success: c.urlRetorno, pending: c.urlRetorno, failure: c.urlRetorno },
        // O provedor recusa retorno automático para endereço sem https, o que
        // inclui o localhost do desenvolvimento.
        ...(c.urlRetorno.startsWith("https://") ? { auto_return: "approved" } : {}),
        expires: true,
        expiration_date_to: expiracao,
        // Prazo do Pix. Boleto fica de fora: compensa em dias, e a reserva do
        // estoque dura uma hora.
        date_of_expiration: expiracao,
        payment_methods: { excluded_payment_types: [{ id: "ticket" }], installments: 12 },
        statement_descriptor: "ZEPNEU",
      };

      let resposta: Response;
      try {
        resposta = await fetch(`${API}/checkout/preferences`, {
          method: "POST",
          // A mesma referência nunca gera duas cobranças, mesmo com retentativa.
          headers: { ...headers, "X-Idempotency-Key": c.orderRef },
          body: JSON.stringify(corpo),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
      } catch (e) {
        console.error("Mercado Pago inacessível ao criar cobrança", e);
        return err("Mercado Pago inacessível");
      }

      if (!resposta.ok) {
        const motivo = await mensagemDeErro(resposta);
        console.error(`Mercado Pago recusou a cobrança ${c.orderRef}: ${motivo}`);
        return err(`Mercado Pago recusou a cobrança: ${motivo}`);
      }

      const pref = (await resposta.json()) as { init_point?: string; sandbox_init_point?: string };
      const url = sandbox ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point;
      if (!url) return err("Mercado Pago não devolveu o link de pagamento");
      return ok({ urlPagamento: url });
    },

    async consultarPagamento(id): Promise<Pagamento | null> {
      // O id vem de uma notificação externa e vai para a URL.
      if (!/^\d+$/.test(id)) return null;

      const resposta = await fetch(`${API}/v1/payments/${id}`, {
        headers,
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (resposta.status === 404) return null;
      if (!resposta.ok) {
        throw new Error(`Mercado Pago: falha ao consultar pagamento ${id}: ${await mensagemDeErro(resposta)}`);
      }

      const p = (await resposta.json()) as {
        id: number;
        status: string;
        external_reference?: string | null;
        transaction_amount: number;
        payment_type_id?: string | null;
      };

      return {
        providerPaymentId: String(p.id),
        orderRef: p.external_reference || null,
        status: STATUS[p.status] ?? "pendente",
        metodo: p.payment_type_id ?? null,
        valorCents: Math.round(p.transaction_amount * 100),
      };
    },
  };
}

/**
 * Confere se o aviso veio mesmo do Mercado Pago.
 *
 * O provedor assina `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com
 * HMAC-SHA256 e a chave secreta do webhook. O id vai em minúsculas, como o
 * provedor o assina. A comparação é em tempo constante para não vazar, pelo
 * tempo de resposta, quantos caracteres da assinatura estavam certos.
 */
export function validarAssinaturaMercadoPago(
  segredo: string,
  args: { xSignature: string | null; xRequestId: string | null; dataId: string | null },
): boolean {
  if (!args.xSignature || !args.dataId) return false;

  const partes = Object.fromEntries(
    args.xSignature.split(",").map((p) => {
      const [chave, ...valor] = p.trim().split("=");
      return [chave, valor.join("=")];
    }),
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  let manifesto = `id:${args.dataId.toLowerCase()};`;
  if (args.xRequestId) manifesto += `request-id:${args.xRequestId};`;
  manifesto += `ts:${ts};`;

  const esperado = createHmac("sha256", segredo).update(manifesto).digest();
  let recebido: Buffer;
  try {
    recebido = Buffer.from(v1, "hex");
  } catch {
    return false;
  }
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
