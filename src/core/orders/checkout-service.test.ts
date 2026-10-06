import { describe, it, expect } from "vitest";
import { createCheckoutService, type EntradaDoCheckout } from "./checkout-service";
import {
  carrinhosFalsos,
  estoqueFalso,
  freteFalso,
  itemDeCarrinho,
  pagamentoFalso,
  pedidosFalsos,
} from "../../../tests/helpers/fakes";
import { err } from "@/core/shared/result";
import type { CartItem } from "@/core/cart/types";
import type { RegrasDeFrete } from "@/core/shipping/regras-de-frete";

const AGORA = new Date("2026-10-05T12:00:00Z");
const MINUTO = 60_000;

const comprador = {
  nome: "Maria Souza",
  email: "maria@exemplo.test",
  telefone: "61999990000",
  cpf: "52998224725",
};

const endereco = {
  cep: "70040010",
  rua: "SBS Quadra 2",
  numero: "10",
  complemento: null,
  bairro: "Asa Sul",
  cidade: "Brasília",
  uf: "DF",
};

const pac = {
  id: "1",
  servico: "PAC",
  transportadora: "Correios",
  prazoDias: 5,
  precoCents: 8990,
};

function montar(
  over: {
    itens?: CartItem[];
    frete?: ReturnType<typeof freteFalso> | null;
    pagamento?: ReturnType<typeof pagamentoFalso> | null;
    estoque?: ReturnType<typeof estoqueFalso>;
    regrasDeFrete?: RegrasDeFrete;
  } = {},
) {
  const carrinhos = carrinhosFalsos(over.itens ?? [itemDeCarrinho()]);
  const estoque = over.estoque ?? estoqueFalso();
  const pedidos = pedidosFalsos();
  const pagamento = over.pagamento === undefined ? pagamentoFalso() : over.pagamento;
  const frete = over.frete === undefined ? freteFalso([pac]) : over.frete;

  const servico = createCheckoutService({
    carrinhos: carrinhos.repo,
    estoque: estoque.repo,
    pedidos: pedidos.repo,
    frete,
    pagamento: pagamento?.provider ?? null,
    regrasDeFrete: over.regrasDeFrete,
    urls: {
      retorno: (ref, token) => `https://loja.test/pedido/${ref}?t=${token}`,
      notificacao: "https://loja.test/api/webhooks/mercado-pago",
    },
    agora: () => AGORA,
  });

  return { servico, carrinhos, estoque, pedidos, pagamento, frete };
}

const retirada: EntradaDoCheckout = { comprador, recebimento: { tipo: "retirada" } };
const entrega: EntradaDoCheckout = {
  comprador,
  recebimento: { tipo: "entrega", endereco, servicoId: "1" },
};

describe("cotarFrete", () => {
  it("manda peso, caixa e valor de cada SKU para o provedor", async () => {
    const { servico, frete } = montar();

    const r = await servico.cotarFrete("t1", "70040010");

    expect(r).toEqual({ ok: true, value: [pac] });
    expect(frete!.cotar).toHaveBeenCalledWith({
      cepDestino: "70040010",
      pacotes: [
        {
          sku: "APT-RA301-2055516",
          quantidade: 2,
          pesoGramas: 8800,
          lengthMm: 652,
          widthMm: 652,
          heightMm: 225,
          valorCents: 32438,
        },
      ],
    });
  });

  it("sem provedor configurado, avisa em vez de quebrar", async () => {
    const { servico } = montar({ frete: null });
    const r = await servico.cotarFrete("t1", "70040010");
    expect(r.ok).toBe(false);
  });

  it("carrinho vazio não cota", async () => {
    const { servico, frete } = montar({ itens: [] });
    const r = await servico.cotarFrete("t1", "70040010");
    expect(r.ok).toBe(false);
    expect(frete!.cotar).not.toHaveBeenCalled();
  });
});

describe("finalizar com retirada", () => {
  it("reserva por 60 minutos, cria o pedido e devolve a URL de pagamento", async () => {
    const { servico, estoque, pedidos, pagamento } = montar();

    const r = await servico.finalizar("t1", retirada);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pedido = pedidos.pedidos.get(r.value.referencia)!;

    expect(pedido.status).toBe("aguardando_pagamento");
    expect(pedido.itemsTotalCents).toBe(64876);
    expect(pedido.shippingCents).toBe(0);
    expect(pedido.totalCents).toBe(64876);
    expect(pedido.cartToken).toBe("t1");
    expect(pedido.expiresAt).toEqual(new Date(AGORA.getTime() + 60 * MINUTO));
    expect(pedido.paymentUrl).toBe(r.value.urlPagamento);

    expect(estoque.reservas.get(r.value.referencia)).toEqual({
      expiresAt: new Date(AGORA.getTime() + 60 * MINUTO),
      status: "ativa",
    });

    const [cobranca] = pagamento!.cobrancas;
    expect(cobranca.orderRef).toBe(r.value.referencia);
    expect(cobranca.freteCents).toBe(0);
    expect(cobranca.expiraEm).toEqual(new Date(AGORA.getTime() + 30 * MINUTO));
    expect(cobranca.urlRetorno).toBe(
      `https://loja.test/pedido/${r.value.referencia}?t=${pedido.accessToken}`,
    );
  });

  it("não esvazia o carrinho: isso só acontece com o pagamento aprovado", async () => {
    const { servico, carrinhos } = montar();
    await servico.finalizar("t1", retirada);
    expect(carrinhos.limpos).toEqual([]);
  });
});

describe("finalizar com entrega", () => {
  it("usa o preço da cotação refeita no servidor", async () => {
    const { servico, pedidos } = montar();

    const r = await servico.finalizar("t1", entrega);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pedido = pedidos.pedidos.get(r.value.referencia)!;
    expect(pedido.shippingCents).toBe(8990);
    expect(pedido.totalCents).toBe(64876 + 8990);
    expect(pedido.recebimento).toEqual({
      tipo: "entrega",
      endereco,
      frete: { servicoId: "1", servico: "PAC", transportadora: "Correios", prazoDias: 5, precoCents: 8990 },
    });
  });

  it("recusa serviço que sumiu da cotação, sem reservar nada", async () => {
    const { servico, estoque } = montar();

    const r = await servico.finalizar("t1", {
      ...entrega,
      recebimento: { ...entrega.recebimento, servicoId: "99" } as never,
    });

    expect(r.ok).toBe(false);
    expect(estoque.repo.reservar).not.toHaveBeenCalled();
  });

  it("frete grátis e prazo de manuseio do painel valem também no fechamento", async () => {
    const { servico, pedidos, pagamento } = montar({
      regrasDeFrete: { prazoManuseioDias: 1, freteGratisAcimaCents: 50_000 },
    });

    const r = await servico.finalizar("t1", entrega);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pedido = pedidos.pedidos.get(r.value.referencia)!;
    expect(pedido.shippingCents).toBe(0);
    expect(pedido.totalCents).toBe(64876);
    expect(pedido.recebimento.tipo === "entrega" && pedido.recebimento.frete.prazoDias).toBe(6);
    expect(pagamento!.cobrancas[0].freteCents).toBe(0);
  });

  it("sem provedor de frete, a entrega fica indisponível", async () => {
    const { servico } = montar({ frete: null });
    const r = await servico.finalizar("t1", entrega);
    expect(r.ok).toBe(false);
  });
});

describe("finalizar — falhas", () => {
  it("sem provedor de pagamento, não reserva nem cria pedido", async () => {
    const { servico, estoque, pedidos } = montar({ pagamento: null });
    const r = await servico.finalizar("t1", retirada);
    expect(r.ok).toBe(false);
    expect(estoque.repo.reservar).not.toHaveBeenCalled();
    expect(pedidos.pedidos.size).toBe(0);
  });

  it("carrinho vazio", async () => {
    const { servico } = montar({ itens: [] });
    const r = await servico.finalizar("t1", retirada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("vazio");
  });

  it("item acima do disponível volta para o carrinho", async () => {
    const { servico, estoque } = montar({
      itens: [itemDeCarrinho({ quantity: 4, disponivel: 2 })],
    });
    const r = await servico.finalizar("t1", retirada);
    expect(r.ok).toBe(false);
    expect(estoque.repo.reservar).not.toHaveBeenCalled();
  });

  it("reserva recusada (outro cliente levou antes) não cria pedido", async () => {
    const estoque = estoqueFalso(
      err({ tipo: "indisponivel", variantId: "v1", pedido: 2, disponivel: 1 }),
    );
    const { servico, pedidos } = montar({ estoque });

    const r = await servico.finalizar("t1", retirada);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("RA301");
    expect(pedidos.pedidos.size).toBe(0);
  });

  it("cobrança recusada pelo provedor cancela o pedido e devolve o estoque", async () => {
    const { servico, pedidos, estoque } = montar({
      pagamento: pagamentoFalso({ falha: "fora do ar" }),
    });

    const r = await servico.finalizar("t1", retirada);

    expect(r.ok).toBe(false);
    const [pedido] = [...pedidos.pedidos.values()];
    expect(pedido.status).toBe("cancelado");
    expect(estoque.reservas.get(pedido.reference)?.status).toBe("liberada");
  });
});

describe("expirarVencidos", () => {
  it("cancela pedido vencido e devolve a reserva; o que está no prazo fica", async () => {
    const { servico, pedidos, estoque } = montar();
    const r1 = await servico.finalizar("t1", retirada);
    if (!r1.ok) throw new Error(r1.error);

    // Ainda no prazo.
    expect(await servico.expirarVencidos(new Date(AGORA.getTime() + 59 * MINUTO))).toBe(0);
    expect(pedidos.pedidos.get(r1.value.referencia)!.status).toBe("aguardando_pagamento");

    expect(await servico.expirarVencidos(new Date(AGORA.getTime() + 61 * MINUTO))).toBe(1);
    expect(pedidos.pedidos.get(r1.value.referencia)!.status).toBe("cancelado");
    expect(estoque.reservas.get(r1.value.referencia)?.status).toBe("liberada");
  });

  it("roda no início de cada checkout", async () => {
    const { servico, estoque } = montar();
    await servico.finalizar("t1", retirada);
    expect(estoque.repo.liberarVencidas).toHaveBeenCalled();
  });
});
