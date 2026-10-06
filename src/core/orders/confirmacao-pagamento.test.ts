import { describe, it, expect } from "vitest";
import { createConfirmacaoDePagamento } from "./confirmacao-pagamento";
import {
  carrinhosFalsos,
  estoqueFalso,
  itemDeCarrinho,
  pagamentoFalso,
  pedidosFalsos,
} from "../../../tests/helpers/fakes";
import type { Pedido } from "./order-repository";
import type { OrderStatus } from "./order-status";
import type { Pagamento } from "@/core/payment/payment-provider";

const REF = "ZP-ABCD2345";

function pedido(status: OrderStatus = "aguardando_pagamento"): Pedido {
  return {
    id: "o1",
    reference: REF,
    accessToken: "tok",
    status,
    comprador: { nome: "Maria", email: "m@exemplo.test", telefone: "61999990000", cpf: "52998224725" },
    recebimento: { tipo: "retirada" },
    rastreio: null,
    notaFiscal: null,
    itens: [],
    itemsTotalCents: 64876,
    shippingCents: 0,
    totalCents: 64876,
    cartToken: "carrinho-1",
    expiresAt: new Date("2026-10-05T13:00:00Z"),
    paymentUrl: "https://pague.test",
    createdAt: new Date("2026-10-05T12:00:00Z"),
  };
}

function pagamento(over: Partial<Pagamento> = {}): Pagamento {
  return {
    providerPaymentId: "123",
    orderRef: REF,
    status: "aprovado",
    metodo: "pix",
    valorCents: 64876,
    ...over,
  };
}

async function montar(status: OrderStatus, pag: Pagamento, reservado = true) {
  const pedidos = pedidosFalsos([pedido(status)]);
  const estoque = estoqueFalso();
  if (reservado) {
    await estoque.repo.reservar({ orderRef: REF, expiresAt: new Date() } as never);
  }
  const carrinhos = carrinhosFalsos([itemDeCarrinho()]);
  const provedor = pagamentoFalso({ pagamentos: [pag] });

  const servico = createConfirmacaoDePagamento({
    pedidos: pedidos.repo,
    estoque: estoque.repo,
    carrinhos: carrinhos.repo,
    pagamento: provedor.provider,
  });
  return { servico, pedidos, estoque, carrinhos };
}

describe("pagamento aprovado", () => {
  it("marca pago, baixa a reserva e esvazia o carrinho de origem", async () => {
    const { servico, pedidos, estoque, carrinhos } = await montar(
      "aguardando_pagamento",
      pagamento(),
    );

    await servico.processar("123");

    expect(pedidos.pedidos.get(REF)!.status).toBe("pago");
    expect(estoque.reservas.get(REF)?.status).toBe("consumida");
    expect(carrinhos.limpos).toEqual(["carrinho-1"]);
    expect(pedidos.pagamentos).toHaveLength(1);
  });

  it("notificação repetida, mesmo simultânea, baixa o estoque uma vez só", async () => {
    const { servico, estoque, carrinhos } = await montar(
      "aguardando_pagamento",
      pagamento(),
    );

    await Promise.all([servico.processar("123"), servico.processar("123")]);
    await servico.processar("123");

    expect(estoque.repo.consumirReserva).toHaveBeenCalledTimes(1);
    expect(carrinhos.limpos).toHaveLength(1);
  });

  it("valor diferente do total não marca pago", async () => {
    const { servico, pedidos } = await montar(
      "aguardando_pagamento",
      pagamento({ valorCents: 100 }),
    );

    await servico.processar("123");

    expect(pedidos.pedidos.get(REF)!.status).toBe("aguardando_pagamento");
    const notas = pedidos.eventos.get(REF)!.map((e) => e.note);
    expect(notas.some((n) => n?.includes("valor"))).toBe(true);
  });

  it("aprovado com o pedido já cancelado pede estorno em vez de reviver o pedido", async () => {
    const { servico, pedidos, estoque } = await montar("cancelado", pagamento(), false);

    await servico.processar("123");

    expect(pedidos.pedidos.get(REF)!.status).toBe("cancelado");
    expect(estoque.repo.consumirReserva).not.toHaveBeenCalled();
    const notas = pedidos.eventos.get(REF)!.map((e) => e.note);
    expect(notas.some((n) => n?.includes("estornar"))).toBe(true);
  });

  it("sem reserva ativa, o pedido fica pago e a falta de estoque é anotada", async () => {
    const { servico, pedidos } = await montar("aguardando_pagamento", pagamento(), false);

    await servico.processar("123");

    expect(pedidos.pedidos.get(REF)!.status).toBe("pago");
    const notas = pedidos.eventos.get(REF)!.map((e) => e.note);
    expect(notas.some((n) => n?.includes("estoque"))).toBe(true);
  });
});

describe("outros status", () => {
  it.each(["pendente", "recusado"] as const)(
    "%s só registra: o cliente pode tentar outro meio na mesma cobrança",
    async (status) => {
      const { servico, pedidos, estoque } = await montar(
        "aguardando_pagamento",
        pagamento({ status }),
      );

      await servico.processar("123");

      expect(pedidos.pedidos.get(REF)!.status).toBe("aguardando_pagamento");
      expect(estoque.reservas.get(REF)?.status).toBe("ativa");
      expect(pedidos.pagamentos[0].pagamento.status).toBe(status);
    },
  );

  it("estorno de pedido pago vira estornado", async () => {
    const { servico, pedidos } = await montar("pago", pagamento({ status: "estornado" }));
    await servico.processar("123");
    expect(pedidos.pedidos.get(REF)!.status).toBe("estornado");
  });
});

describe("notificação que não é nossa", () => {
  it("pagamento sem referência é ignorado", async () => {
    const { servico, pedidos } = await montar(
      "aguardando_pagamento",
      pagamento({ orderRef: null }),
    );
    const r = await servico.processar("123");
    expect(r.ok).toBe(true);
    expect(pedidos.pagamentos).toHaveLength(0);
  });

  it("referência desconhecida é ignorada", async () => {
    const { servico } = await montar(
      "aguardando_pagamento",
      pagamento({ orderRef: "ZP-NAOEXIST" }),
    );
    const r = await servico.processar("123");
    expect(r.ok).toBe(true);
  });

  it("id que o provedor não conhece é erro", async () => {
    const { servico } = await montar("aguardando_pagamento", pagamento());
    const r = await servico.processar("999");
    expect(r.ok).toBe(false);
  });
});
