import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  testDb,
  limparDadosDeTeste,
  semearCatalogo,
  localPadrao,
  idDeTeste,
  type CatalogoDeTeste,
} from "../helpers/db";
import { pagamentoFalso } from "../helpers/fakes";
import * as schema from "@/db/schema";
import { createDrizzleOrderRepository } from "@/db/repositories/drizzle-order-repository";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";
import { createDrizzleCartRepository } from "@/db/repositories/drizzle-cart-repository";
import { createConfirmacaoDePagamento } from "@/core/orders/confirmacao-pagamento";
import { createCheckoutService } from "@/core/orders/checkout-service";
import { createGestaoDePedidos } from "@/core/orders/gestao-de-pedidos";
import type { NovoPedido } from "@/core/orders/order-repository";

let cat: CatalogoDeTeste;
let pedidos: ReturnType<typeof createDrizzleOrderRepository>;
let estoque: ReturnType<typeof createDrizzleStockRepository>;
let carrinhos: ReturnType<typeof createDrizzleCartRepository>;

beforeEach(async () => {
  await limparDadosDeTeste();
  cat = await semearCatalogo();
  const local = await localPadrao();
  estoque = createDrizzleStockRepository(testDb, local.id);
  pedidos = createDrizzleOrderRepository(testDb);
  carrinhos = createDrizzleCartRepository(testDb, estoque);
});

afterAll(limparDadosDeTeste);

function novoPedido(over: Partial<NovoPedido> = {}): NovoPedido {
  const variante = cat.variantes[0];
  return {
    // Prefixo de teste: a limpeza remove exatamente estes pedidos.
    reference: idDeTeste(),
    accessToken: idDeTeste(),
    comprador: { nome: "Maria", email: "m@exemplo.test", telefone: "61999990000", cpf: "52998224725" },
    recebimento: {
      tipo: "entrega",
      endereco: { cep: "70040010", rua: "SBS Q2", numero: "10", complemento: "Bloco A", bairro: "Asa Sul", cidade: "Brasília", uf: "DF" },
      frete: { servicoId: "2", servico: "SEDEX", transportadora: "Correios", prazoDias: 3, precoCents: 9000 },
    },
    itens: [
      { variantId: variante.id, sku: variante.sku, productName: "Primacy 4", sizeLabel: "205/55 R16 91V", unitPriceCents: 65000, quantity: 2 },
    ],
    itemsTotalCents: 130000,
    shippingCents: 9000,
    totalCents: 139000,
    cartToken: idDeTeste(),
    expiresAt: new Date(Date.now() + 60 * 60_000),
    ...over,
  };
}

describe("criar e ler", () => {
  it("guarda comprador, endereço, frete e itens congelados", async () => {
    const novo = novoPedido();
    await pedidos.criar(novo);

    const lido = await pedidos.porReferencia(novo.reference);

    expect(lido).toMatchObject({
      reference: novo.reference,
      status: "aguardando_pagamento",
      comprador: novo.comprador,
      recebimento: novo.recebimento,
      itens: novo.itens,
      totalCents: 139000,
      cartToken: novo.cartToken,
    });
    const eventos = await pedidos.eventos(novo.reference);
    expect(eventos.map((e) => e.toStatus)).toEqual(["aguardando_pagamento"]);
  });

  it("retirada não grava endereço", async () => {
    const novo = novoPedido({ recebimento: { tipo: "retirada" }, shippingCents: 0, totalCents: 130000 });
    await pedidos.criar(novo);
    expect((await pedidos.porReferencia(novo.reference))!.recebimento).toEqual({ tipo: "retirada" });
  });
});

describe("transicionar", () => {
  it("só troca a partir do status esperado, e grava o evento", async () => {
    const novo = novoPedido();
    await pedidos.criar(novo);

    expect(await pedidos.transicionar(novo.reference, "pago", "em_separacao", "x")).toBe(false);
    expect(await pedidos.transicionar(novo.reference, "aguardando_pagamento", "pago", "aprovado")).toBe(true);

    const eventos = await pedidos.eventos(novo.reference);
    expect(eventos.at(-1)).toMatchObject({ fromStatus: "aguardando_pagamento", toStatus: "pago", note: "aprovado" });
  });

  it("duas trocas simultâneas: exatamente uma vence", async () => {
    const novo = novoPedido();
    await pedidos.criar(novo);

    const resultados = await Promise.all(
      Array.from({ length: 5 }, () =>
        pedidos.transicionar(novo.reference, "aguardando_pagamento", "pago", "aprovado"),
      ),
    );

    expect(resultados.filter(Boolean)).toHaveLength(1);
  });
});

describe("confirmação contra o banco real", () => {
  it("notificações simultâneas do mesmo pagamento baixam o estoque uma vez só", async () => {
    const variante = cat.variantes[0];
    await estoque.registrarEntrada({ variantId: variante.id, quantity: 5, reason: "teste", authorId: "teste" });

    const novo = novoPedido();
    const reserva = await estoque.reservar({
      orderRef: novo.reference,
      itens: [{ variantId: variante.id, quantity: 2 }],
      expiresAt: novo.expiresAt,
    });
    expect(reserva.ok).toBe(true);
    await pedidos.criar(novo);

    const provedor = pagamentoFalso({
      pagamentos: [{ providerPaymentId: "777", orderRef: novo.reference, status: "aprovado", metodo: "pix", valorCents: 139000 }],
    });
    const confirmacao = createConfirmacaoDePagamento({
      pedidos,
      estoque,
      carrinhos,
      pagamento: provedor.provider,
    });

    await Promise.all(Array.from({ length: 4 }, () => confirmacao.processar("777")));

    const [saldo] = await estoque.disponibilidadeDe([variante.id]);
    expect(saldo.onHand).toBe(3);
    expect(saldo.reserved).toBe(0);
    expect((await pedidos.porReferencia(novo.reference))!.status).toBe("pago");

    const registros = await testDb
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.providerPaymentId, "777"));
    expect(registros).toHaveLength(1);
  });
});

describe("expiração", () => {
  it("cancela o vencido, devolve o estoque e não toca no que está no prazo", async () => {
    const variante = cat.variantes[0];
    await estoque.registrarEntrada({ variantId: variante.id, quantity: 5, reason: "teste", authorId: "teste" });

    const vencido = novoPedido({ expiresAt: new Date(Date.now() - 60_000) });
    const noPrazo = novoPedido();
    for (const p of [vencido, noPrazo]) {
      await estoque.reservar({ orderRef: p.reference, itens: [{ variantId: variante.id, quantity: 2 }], expiresAt: p.expiresAt });
      await pedidos.criar(p);
    }

    const checkout = createCheckoutService({
      carrinhos,
      estoque,
      pedidos,
      frete: null,
      pagamento: null,
      urls: { retorno: () => "", notificacao: "" },
    });
    await checkout.expirarVencidos();

    expect((await pedidos.porReferencia(vencido.reference))!.status).toBe("cancelado");
    expect((await pedidos.porReferencia(noPrazo.reference))!.status).toBe("aguardando_pagamento");
    const [saldo] = await estoque.disponibilidadeDe([variante.id]);
    expect(saldo.reserved).toBe(2);
  });
});

describe("gestão pelo painel contra o banco real", () => {
  async function pedidoPago() {
    const variante = cat.variantes[0];
    await estoque.registrarEntrada({ variantId: variante.id, quantity: 5, reason: "teste", authorId: "teste" });
    const novo = novoPedido();
    await estoque.reservar({ orderRef: novo.reference, itens: [{ variantId: variante.id, quantity: 2 }], expiresAt: novo.expiresAt });
    await pedidos.criar(novo);
    await pedidos.transicionar(novo.reference, "aguardando_pagamento", "pago", "teste");
    await estoque.consumirReserva(novo.reference);
    return { ref: novo.reference, variante };
  }

  it("cancelar pedido pago devolve o pneu ao estoque, uma vez só, com autor no histórico", async () => {
    const { ref, variante } = await pedidoPago();
    const gestao = createGestaoDePedidos({ pedidos, estoque });

    const r = await gestao.mudarStatus(ref, "cancelado", { autor: "ana@zepneu.test" });
    expect(r.ok).toBe(true);
    // Chamada repetida (duplo clique, outra aba) não devolve de novo.
    expect(await estoque.devolverBaixa(ref, "ana@zepneu.test")).toBe(0);

    const [saldo] = await estoque.disponibilidadeDe([variante.id]);
    expect(saldo.onHand).toBe(5);
    expect(saldo.reserved).toBe(0);

    const extrato = await estoque.extrato(variante.id);
    expect(extrato.filter((m) => m.kind === "estorno")).toHaveLength(1);

    const eventos = await pedidos.eventos(ref);
    expect(eventos.find((e) => e.toStatus === "cancelado" && e.fromStatus === "pago")?.autor).toBe("ana@zepneu.test");
  });

  it("grava rastreio e nota fiscal no pedido", async () => {
    const { ref } = await pedidoPago();
    await pedidos.definirRastreio(ref, "AA123456789BR");
    await pedidos.definirNotaFiscal(ref, { numero: "1234", chave: "3".repeat(44) });

    const lido = await pedidos.porReferencia(ref);
    expect(lido!.rastreio).toBe("AA123456789BR");
    expect(lido!.notaFiscal).toEqual({ numero: "1234", chave: "3".repeat(44) });
  });
});
