import { describe, it, expect } from "vitest";
import { createGestaoDePedidos, proximosStatus } from "./gestao-de-pedidos";
import { estoqueFalso, pedidosFalsos } from "../../../tests/helpers/fakes";
import type { Pedido } from "./order-repository";
import type { OrderStatus } from "./order-status";

const REF = "ZP-ABCD2345";
const AUTOR = "ana@zepneu.test";

function pedido(status: OrderStatus, tipo: "retirada" | "entrega" = "retirada"): Pedido {
  return {
    id: "o1",
    reference: REF,
    accessToken: "tok",
    status,
    comprador: { nome: "Maria", email: "m@exemplo.test", telefone: "61999990000", cpf: "52998224725" },
    recebimento:
      tipo === "retirada"
        ? { tipo: "retirada" }
        : {
            tipo: "entrega",
            endereco: { cep: "70040010", rua: "SBS", numero: "1", complemento: null, bairro: "Asa Sul", cidade: "Brasília", uf: "DF" },
            frete: { servicoId: "1", servico: "PAC", transportadora: "Correios", prazoDias: 5, precoCents: 8990 },
          },
    rastreio: null,
    notaFiscal: null,
    itens: [],
    itemsTotalCents: 64876,
    shippingCents: 0,
    totalCents: 64876,
    cartToken: "t1",
    expiresAt: new Date(),
    paymentUrl: null,
    createdAt: new Date(),
  };
}

function montar(p: Pedido, reserva?: string) {
  const pedidos = pedidosFalsos([p]);
  const estoque = estoqueFalso();
  if (reserva) estoque.reservas.set(REF, { expiresAt: new Date(), status: reserva });
  const gestao = createGestaoDePedidos({ pedidos: pedidos.repo, estoque: estoque.repo });
  return { gestao, pedidos, estoque };
}

describe("mudarStatus", () => {
  it("segue o fluxo e registra quem mudou", async () => {
    const { gestao, pedidos } = montar(pedido("pago"));

    const r = await gestao.mudarStatus(REF, "em_separacao", { autor: AUTOR });

    expect(r.ok).toBe(true);
    expect(pedidos.pedidos.get(REF)!.status).toBe("em_separacao");
    expect(pedidos.eventos.get(REF)!.at(-1)).toMatchObject({ toStatus: "em_separacao", autor: AUTOR });
  });

  it("recusa transição fora do fluxo", async () => {
    const { gestao, pedidos } = montar(pedido("aguardando_pagamento"));
    const r = await gestao.mudarStatus(REF, "enviado", { autor: AUTOR });
    expect(r.ok).toBe(false);
    expect(pedidos.pedidos.get(REF)!.status).toBe("aguardando_pagamento");
  });

  it("pedido de retirada não vira enviado, e de entrega não fica pronto para retirada", async () => {
    const retirada = montar(pedido("em_separacao", "retirada"));
    expect((await retirada.gestao.mudarStatus(REF, "enviado", { autor: AUTOR })).ok).toBe(false);

    const entrega = montar(pedido("em_separacao", "entrega"));
    expect((await entrega.gestao.mudarStatus(REF, "pronto_para_retirada", { autor: AUTOR })).ok).toBe(false);
  });

  it("ao enviar, grava o rastreio", async () => {
    const { gestao, pedidos } = montar(pedido("em_separacao", "entrega"));
    await gestao.mudarStatus(REF, "enviado", { autor: AUTOR, rastreio: " AA123456789BR " });
    expect(pedidos.pedidos.get(REF)!.rastreio).toBe("AA123456789BR");
  });

  it("cancelar antes do pagamento devolve a reserva", async () => {
    const { gestao, estoque } = montar(pedido("aguardando_pagamento"), "ativa");
    const r = await gestao.mudarStatus(REF, "cancelado", { autor: AUTOR });
    expect(r.ok).toBe(true);
    expect(estoque.reservas.get(REF)!.status).toBe("liberada");
    expect(estoque.repo.devolverBaixa).not.toHaveBeenCalled();
  });

  it("cancelar pedido pago devolve o pneu à prateleira e lembra do estorno", async () => {
    const { gestao, estoque, pedidos } = montar(pedido("em_separacao"), "consumida");

    const r = await gestao.mudarStatus(REF, "cancelado", { autor: AUTOR });

    expect(r.ok).toBe(true);
    expect(estoque.repo.devolverBaixa).toHaveBeenCalledWith(REF, AUTOR);
    expect(estoque.reservas.get(REF)!.status).toBe("devolvida");
    expect(pedidos.eventos.get(REF)!.some((e) => e.note?.includes("estornar"))).toBe(true);
  });

  it("estorno de pedido já enviado não mexe no estoque: o pneu está na estrada", async () => {
    const { gestao, estoque, pedidos } = montar(pedido("enviado", "entrega"), "consumida");

    const r = await gestao.mudarStatus(REF, "estornado", { autor: AUTOR });

    expect(r.ok).toBe(true);
    expect(estoque.repo.devolverBaixa).not.toHaveBeenCalled();
    expect(pedidos.eventos.get(REF)!.at(-1)!.note).toContain("dê entrada no estoque");
  });

  it("se o pedido mudou no meio do caminho, não sobrescreve", async () => {
    const { gestao, pedidos } = montar(pedido("pago"));
    // Outro operador mudou entre a leitura e a gravação.
    const original = pedidos.repo.porReferencia;
    pedidos.repo.porReferencia = async (ref) => {
      const p = await original(ref);
      const copia = { ...p! };
      pedidos.pedidos.get(REF)!.status = "cancelado";
      return copia;
    };

    const r = await gestao.mudarStatus(REF, "em_separacao", { autor: AUTOR });
    expect(r.ok).toBe(false);
    expect(pedidos.pedidos.get(REF)!.status).toBe("cancelado");
  });
});

describe("pago só pelo provedor", () => {
  it("o painel não marca pedido como pago", async () => {
    const { gestao, pedidos } = montar(pedido("aguardando_pagamento"), "ativa");
    const r = await gestao.mudarStatus(REF, "pago", { autor: AUTOR });
    expect(r.ok).toBe(false);
    expect(pedidos.pedidos.get(REF)!.status).toBe("aguardando_pagamento");
  });

  it("os botões oferecidos seguem o tipo de recebimento", () => {
    expect(proximosStatus("aguardando_pagamento", "retirada")).toEqual(["cancelado"]);
    expect(proximosStatus("em_separacao", "retirada")).toEqual(["pronto_para_retirada", "cancelado", "estornado"]);
    expect(proximosStatus("em_separacao", "entrega")).toEqual(["enviado", "cancelado", "estornado"]);
  });
});

describe("nota fiscal e rastreio", () => {
  it("valida a chave de 44 dígitos", async () => {
    const { gestao, pedidos } = montar(pedido("pago"));
    expect((await gestao.registrarNotaFiscal(REF, { numero: "123", chave: "999" }, AUTOR)).ok).toBe(false);

    const chave = "5".repeat(44);
    expect((await gestao.registrarNotaFiscal(REF, { numero: "123", chave }, AUTOR)).ok).toBe(true);
    expect(pedidos.pedidos.get(REF)!.notaFiscal).toEqual({ numero: "123", chave });
  });

  it("pedido de retirada não tem rastreio", async () => {
    const { gestao } = montar(pedido("pago", "retirada"));
    expect((await gestao.registrarRastreio(REF, "AA1BR", AUTOR)).ok).toBe(false);
  });
});
