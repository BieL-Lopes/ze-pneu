import { describe, it, expect, vi } from "vitest";
import { createMelhorEnvioProvider } from "./melhor-envio";
import type { Pacote } from "@/core/shipping/shipping-provider";

function respostaJson(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const pacote: Pacote = {
  sku: "APT-RA301-2055516",
  quantidade: 2,
  pesoGramas: 8800,
  lengthMm: 652,
  widthMm: 652,
  heightMm: 225,
  valorCents: 32438,
};

function provedor(fetch: ReturnType<typeof vi.fn>, ambiente: "sandbox" | "producao" = "sandbox") {
  return createMelhorEnvioProvider({
    token: "tok",
    ambiente,
    cepOrigem: "70040010",
    email: "contato@zepneu.test",
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
}

describe("cotar", () => {
  it("manda medidas em cm, peso em kg e seguro em reais", async () => {
    const fetch = vi.fn(async () => respostaJson(200, []));
    await provedor(fetch).cotar({ cepDestino: "01310100", pacotes: [pacote] });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    // A API exige contato no User-Agent.
    expect(headers["User-Agent"]).toBe("Ze Pneu (contato@zepneu.test)");

    expect(JSON.parse(init.body as string)).toEqual({
      from: { postal_code: "70040010" },
      to: { postal_code: "01310100" },
      products: [
        { id: "APT-RA301-2055516", width: 66, height: 23, length: 66, weight: 8.8, insurance_value: 324.38, quantity: 2 },
      ],
      options: { receipt: false, own_hand: false },
    });
  });

  it("em produção usa o endereço real", async () => {
    const fetch = vi.fn(async () => respostaJson(200, []));
    await provedor(fetch, "producao").cotar({ cepDestino: "01310100", pacotes: [pacote] });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://melhorenvio.com.br/api/v2/me/shipment/calculate",
    );
  });

  it("devolve as opções válidas, com o preço da conta, da mais barata para a mais cara", async () => {
    const fetch = vi.fn(async () =>
      respostaJson(200, [
        { id: 2, name: "SEDEX", price: "150.30", custom_price: "140.10", delivery_time: 2, custom_delivery_time: 3, company: { name: "Correios" } },
        { id: 1, name: "PAC", error: "Dimensões excedem o limite" , company: { name: "Correios" } },
        { id: 17, name: ".Com", price: "98.50", delivery_time: 6, company: { name: "Jadlog" } },
      ]),
    );

    const r = await provedor(fetch).cotar({ cepDestino: "01310100", pacotes: [pacote] });

    expect(r).toEqual({
      ok: true,
      value: [
        { id: "17", servico: ".Com", transportadora: "Jadlog", prazoDias: 6, precoCents: 9850 },
        { id: "2", servico: "SEDEX", transportadora: "Correios", prazoDias: 3, precoCents: 14010 },
      ],
    });
  });

  it("nenhuma transportadora atende vira mensagem para o cliente", async () => {
    const fetch = vi.fn(async () =>
      respostaJson(200, [{ id: 1, name: "PAC", error: "Dimensões excedem o limite" }]),
    );
    const r = await provedor(fetch).cotar({ cepDestino: "01310100", pacotes: [pacote] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("retirada");
  });

  it("erro HTTP ou rede vira falha esperada", async () => {
    const http = vi.fn(async () => respostaJson(401, { message: "Unauthenticated." }));
    expect((await provedor(http).cotar({ cepDestino: "01310100", pacotes: [pacote] })).ok).toBe(false);

    const rede = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect((await provedor(rede).cotar({ cepDestino: "01310100", pacotes: [pacote] })).ok).toBe(false);
  });
});
