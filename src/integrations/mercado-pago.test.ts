import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  createMercadoPagoProvider,
  validarAssinaturaMercadoPago,
} from "./mercado-pago";
import type { NovaCobranca } from "@/core/payment/payment-provider";

function respostaJson(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const cobranca: NovaCobranca = {
  orderRef: "ZP-ABCD2345",
  itens: [
    { sku: "APT-RA301-2055516", titulo: "RA301 205/55 R16 91V", quantidade: 2, precoUnitarioCents: 32438 },
  ],
  freteCents: 8990,
  comprador: { nome: "Maria Souza", email: "maria@exemplo.test", cpf: "52998224725", telefone: "61999990000" },
  expiraEm: new Date("2026-10-05T12:30:00.000Z"),
  urlRetorno: "https://loja.test/pedido/ZP-ABCD2345?t=tok",
  urlNotificacao: "https://loja.test/api/webhooks/mercado-pago",
};

describe("criarCobranca", () => {
  it("cria a preferência com referência, expiração e frete como item", async () => {
    const fetch = vi.fn(async () =>
      respostaJson(201, { id: "pref-1", init_point: "https://mp.test/pagar", sandbox_init_point: "https://sandbox.mp.test/pagar" }),
    );
    const mp = createMercadoPagoProvider({ accessToken: "APP_USR-123", fetch });

    const r = await mp.criarCobranca(cobranca);

    expect(r).toEqual({ ok: true, value: { urlPagamento: "https://mp.test/pagar" } });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer APP_USR-123");
    expect(headers["X-Idempotency-Key"]).toBe("ZP-ABCD2345");

    const corpo = JSON.parse(init.body as string);
    expect(corpo.external_reference).toBe("ZP-ABCD2345");
    expect(corpo.notification_url).toBe(cobranca.urlNotificacao);
    expect(corpo.back_urls.success).toBe(cobranca.urlRetorno);
    expect(corpo.auto_return).toBe("approved");
    expect(corpo.date_of_expiration).toBe("2026-10-05T12:30:00.000Z");
    expect(corpo.expiration_date_to).toBe("2026-10-05T12:30:00.000Z");
    // Boleto compensa em dias; a reserva dura uma hora.
    expect(corpo.payment_methods.excluded_payment_types).toEqual([{ id: "ticket" }]);
    expect(corpo.payer.identification).toEqual({ type: "CPF", number: "52998224725" });
    // Frete como item: assim o valor do pagamento é a soma dos itens, e a
    // confirmação compara com o total do pedido sem depender de outro campo.
    expect(corpo.items).toEqual([
      { id: "APT-RA301-2055516", title: "RA301 205/55 R16 91V", quantity: 2, unit_price: 324.38, currency_id: "BRL" },
      { id: "frete", title: "Frete", quantity: 1, unit_price: 89.9, currency_id: "BRL" },
    ]);
  });

  it("sem frete não manda item de frete", async () => {
    const fetch = vi.fn(async () => respostaJson(201, { init_point: "https://mp.test/p" }));
    const mp = createMercadoPagoProvider({ accessToken: "APP_USR-123", fetch });
    await mp.criarCobranca({ ...cobranca, freteCents: 0 });
    const corpo = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corpo.items).toHaveLength(1);
  });

  it("com credencial de teste usa a URL do sandbox", async () => {
    const fetch = vi.fn(async () =>
      respostaJson(201, { init_point: "https://mp.test/p", sandbox_init_point: "https://sandbox.mp.test/p" }),
    );
    const mp = createMercadoPagoProvider({ accessToken: "TEST-123", fetch });
    const r = await mp.criarCobranca(cobranca);
    expect(r).toEqual({ ok: true, value: { urlPagamento: "https://sandbox.mp.test/p" } });
  });

  it("em localhost não pede retorno automático, que o provedor recusa sem https", async () => {
    const fetch = vi.fn(async () => respostaJson(201, { init_point: "https://mp.test/p" }));
    const mp = createMercadoPagoProvider({ accessToken: "APP_USR-1", fetch });
    await mp.criarCobranca({ ...cobranca, urlRetorno: "http://localhost:3000/pedido/x" });
    const corpo = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corpo.auto_return).toBeUndefined();
  });

  it("erro do provedor vira falha esperada, não exceção", async () => {
    const fetch = vi.fn(async () => respostaJson(400, { message: "invalid payer" }));
    const mp = createMercadoPagoProvider({ accessToken: "APP_USR-1", fetch });
    const r = await mp.criarCobranca(cobranca);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("invalid payer");
  });
});

describe("consultarPagamento", () => {
  it.each([
    ["approved", "aprovado"],
    ["pending", "pendente"],
    ["in_process", "pendente"],
    ["rejected", "recusado"],
    ["cancelled", "recusado"],
    ["refunded", "estornado"],
    ["charged_back", "estornado"],
  ])("traduz %s para %s", async (status, esperado) => {
    const fetch = vi.fn(async () =>
      respostaJson(200, {
        id: 123,
        status,
        external_reference: "ZP-ABCD2345",
        transaction_amount: 738.66,
        payment_type_id: "bank_transfer",
      }),
    );
    const mp = createMercadoPagoProvider({ accessToken: "APP_USR-1", fetch });

    const p = await mp.consultarPagamento("123");

    expect(p).toEqual({
      providerPaymentId: "123",
      orderRef: "ZP-ABCD2345",
      status: esperado,
      metodo: "bank_transfer",
      valorCents: 73866,
    });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("https://api.mercadopago.com/v1/payments/123");
  });

  it("id desconhecido devolve null", async () => {
    const fetch = vi.fn(async () => respostaJson(404, { message: "not found" }));
    const mp = createMercadoPagoProvider({ accessToken: "APP_USR-1", fetch });
    expect(await mp.consultarPagamento("999")).toBeNull();
  });

  it("recusa id que não é numérico antes de montar a URL", async () => {
    const fetch = vi.fn();
    const mp = createMercadoPagoProvider({ accessToken: "APP_USR-1", fetch });
    expect(await mp.consultarPagamento("../users/me")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("validarAssinaturaMercadoPago", () => {
  const segredo = "segredo-do-webhook";

  function assinar(dataId: string, requestId: string, ts: string) {
    const manifesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
    return createHmac("sha256", segredo).update(manifesto).digest("hex");
  }

  it("aceita assinatura feita com a chave secreta", () => {
    const v1 = assinar("123", "req-1", "1700000000");
    expect(
      validarAssinaturaMercadoPago(segredo, {
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: "req-1",
        dataId: "123",
      }),
    ).toBe(true);
  });

  it("usa o id em minúsculas, como o provedor assina", () => {
    const v1 = assinar("abc123", "req-1", "1700000000");
    expect(
      validarAssinaturaMercadoPago(segredo, {
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: "req-1",
        dataId: "ABC123",
      }),
    ).toBe(true);
  });

  it("recusa assinatura de outro id, outra chave ou cabeçalho ausente", () => {
    const v1 = assinar("123", "req-1", "1700000000");
    const base = { xSignature: `ts=1700000000,v1=${v1}`, xRequestId: "req-1", dataId: "123" };
    expect(validarAssinaturaMercadoPago(segredo, { ...base, dataId: "124" })).toBe(false);
    expect(validarAssinaturaMercadoPago("outra", base)).toBe(false);
    expect(validarAssinaturaMercadoPago(segredo, { ...base, xSignature: null })).toBe(false);
    expect(validarAssinaturaMercadoPago(segredo, { ...base, xSignature: "lixo" })).toBe(false);
  });
});
