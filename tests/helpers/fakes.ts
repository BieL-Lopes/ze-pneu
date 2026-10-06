import { vi } from "vitest";
import type { Cart, CartItem } from "@/core/cart/types";
import type { CartRepository } from "@/core/cart/cart-repository";
import type { StockRepository } from "@/core/stock/stock-repository";
import type {
  EventoDoPedido,
  OrderRepository,
  Pedido,
} from "@/core/orders/order-repository";
import type { OrderStatus } from "@/core/orders/order-status";
import type {
  NovaCobranca,
  Pagamento,
  PaymentProvider,
} from "@/core/payment/payment-provider";
import type {
  OpcaoDeFrete,
  ShippingProvider,
} from "@/core/shipping/shipping-provider";
import { ok, type Result } from "@/core/shared/result";

/**
 * Portas em memória para os testes de unidade do checkout.
 *
 * São implementações de verdade, não mocks de chamada: o teste verifica o
 * estado final (pedido cancelado, reserva liberada) em vez de quantas vezes
 * uma função foi chamada.
 */

export function itemDeCarrinho(over: Partial<CartItem> = {}): CartItem {
  return {
    variantId: "v1",
    sku: "APT-RA301-2055516",
    productName: "RA301",
    productSlug: "aptany-ra301",
    sizeLabel: "205/55 R16 91V",
    unitPriceCents: 32438,
    quantity: 2,
    disponivel: 10,
    envio: { pesoGramas: 8800, lengthMm: 652, widthMm: 652, heightMm: 225 },
    ...over,
  };
}

export function carrinhosFalsos(itens: CartItem[]) {
  const limpos: string[] = [];
  const repo: CartRepository = {
    async obterOuCriar(token): Promise<Cart> {
      return { id: "c1", token, itens: limpos.includes(token) ? [] : itens };
    },
    async definirItem() {
      throw new Error("não usado");
    },
    async remover() {
      throw new Error("não usado");
    },
    async limpar(token) {
      limpos.push(token);
    },
  };
  return { repo, limpos };
}

export function estoqueFalso(falha?: Awaited<ReturnType<StockRepository["reservar"]>>) {
  const reservas = new Map<string, { expiresAt: Date; status: string }>();
  const repo = {
    reservar: vi.fn(async ({ orderRef, expiresAt }: { orderRef: string; expiresAt: Date }) => {
      if (falha && !falha.ok) return falha;
      reservas.set(orderRef, { expiresAt, status: "ativa" });
      return ok(undefined);
    }),
    liberarReserva: vi.fn(async (ref: string) => {
      const r = reservas.get(ref);
      if (r?.status === "ativa") r.status = "liberada";
    }),
    consumirReserva: vi.fn(async (ref: string) => {
      const r = reservas.get(ref);
      if (r?.status !== "ativa") {
        return { ok: false as const, error: { tipo: "reserva_inexistente" as const, orderRef: ref } };
      }
      r.status = "consumida";
      return ok(undefined);
    }),
    liberarVencidas: vi.fn(async () => 0),
    devolverBaixa: vi.fn(async (ref: string) => {
      const r = reservas.get(ref);
      if (r?.status !== "consumida") return 0;
      r.status = "devolvida";
      return 2;
    }),
  };
  return { repo, reservas };
}

export function pedidosFalsos(iniciais: Pedido[] = []) {
  const pedidos = new Map(iniciais.map((p) => [p.reference, p]));
  const eventos = new Map<string, EventoDoPedido[]>();
  const pagamentos: { ref: string; pagamento: Pagamento }[] = [];

  function evento(ref: string, e: Omit<EventoDoPedido, "createdAt">) {
    eventos.set(ref, [...(eventos.get(ref) ?? []), { ...e, createdAt: new Date() }]);
  }

  const repo: OrderRepository = {
    async criar(novo) {
      const pedido: Pedido = {
        ...novo,
        id: `id-${novo.reference}`,
        status: "aguardando_pagamento",
        paymentUrl: null,
        rastreio: null,
        notaFiscal: null,
        createdAt: new Date(),
      };
      pedidos.set(novo.reference, pedido);
      evento(novo.reference, { fromStatus: null, toStatus: "aguardando_pagamento", note: "Pedido criado" });
      return pedido;
    },
    async porReferencia(ref) {
      return pedidos.get(ref) ?? null;
    },
    async eventos(ref) {
      return eventos.get(ref) ?? [];
    },
    async definirUrlDePagamento(ref, url) {
      const p = pedidos.get(ref);
      if (p) p.paymentUrl = url;
    },
    async transicionar(ref, de: OrderStatus, para: OrderStatus, nota, autor) {
      const p = pedidos.get(ref);
      if (!p || p.status !== de) return false;
      p.status = para;
      evento(ref, { fromStatus: de, toStatus: para, note: nota, autor: autor ?? null });
      return true;
    },
    async anotar(ref, nota, autor) {
      const p = pedidos.get(ref);
      if (p) evento(ref, { fromStatus: p.status, toStatus: p.status, note: nota, autor: autor ?? null });
    },
    async definirRastreio(ref, codigo) {
      const p = pedidos.get(ref);
      if (p) p.rastreio = codigo;
    },
    async definirNotaFiscal(ref, nota) {
      const p = pedidos.get(ref);
      if (p) p.notaFiscal = nota;
    },
    async registrarPagamento(ref, _provedor, pagamento) {
      pagamentos.push({ ref, pagamento });
    },
    async vencidos(agora) {
      return [...pedidos.values()]
        .filter((p) => p.status === "aguardando_pagamento" && p.expiresAt <= agora)
        .map((p) => p.reference);
    },
  };
  return { repo, pedidos, eventos, pagamentos };
}

export function freteFalso(opcoes: OpcaoDeFrete[] | string) {
  const provider: ShippingProvider = {
    cotar: vi.fn(async (): Promise<Result<OpcaoDeFrete[], string>> =>
      typeof opcoes === "string" ? { ok: false, error: opcoes } : ok(opcoes),
    ),
  };
  return provider;
}

export function pagamentoFalso(
  opcoes: { falha?: string; pagamentos?: Pagamento[] } = {},
) {
  const cobrancas: NovaCobranca[] = [];
  const provider: PaymentProvider = {
    nome: "falso",
    async criarCobranca(c) {
      cobrancas.push(c);
      if (opcoes.falha) return { ok: false, error: opcoes.falha };
      return ok({ urlPagamento: `https://pague.test/${c.orderRef}` });
    },
    async consultarPagamento(id) {
      return opcoes.pagamentos?.find((p) => p.providerPaymentId === id) ?? null;
    },
  };
  return { provider, cobrancas };
}
