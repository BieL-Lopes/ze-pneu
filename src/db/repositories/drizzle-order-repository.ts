import { and, asc, eq, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { orderEvents, orderItems, orders, payments } from "@/db/schema";
import type {
  EventoDoPedido,
  OrderRepository,
  Pedido,
  Recebimento,
} from "@/core/orders/order-repository";

type LinhaDoPedido = typeof orders.$inferSelect;
type LinhaDoItem = typeof orderItems.$inferSelect;

function recebimentoDa(l: LinhaDoPedido): Recebimento {
  if (l.deliveryMethod === "retirada") return { tipo: "retirada" };
  return {
    tipo: "entrega",
    endereco: {
      cep: l.shippingPostalCode ?? "",
      rua: l.shippingStreet ?? "",
      numero: l.shippingNumber ?? "",
      complemento: l.shippingComplement,
      bairro: l.shippingDistrict ?? "",
      cidade: l.shippingCity ?? "",
      uf: l.shippingState ?? "",
    },
    frete: {
      servicoId: l.shippingServiceId ?? "",
      servico: l.shippingServiceName ?? "",
      transportadora: l.shippingCarrier ?? "",
      prazoDias: l.shippingDeadlineDays ?? 0,
      precoCents: l.shippingCents,
    },
  };
}

function paraPedido(l: LinhaDoPedido, itens: LinhaDoItem[]): Pedido {
  return {
    id: l.id,
    reference: l.reference,
    accessToken: l.accessToken,
    status: l.status,
    comprador: {
      nome: l.customerName,
      email: l.customerEmail,
      telefone: l.customerPhone,
      cpf: l.customerDocument ?? "",
    },
    recebimento: recebimentoDa(l),
    itens: itens.map((i) => ({
      variantId: i.variantId,
      sku: i.sku,
      productName: i.productName,
      sizeLabel: i.sizeLabel,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
    })),
    itemsTotalCents: l.itemsTotalCents,
    shippingCents: l.shippingCents,
    totalCents: l.totalCents,
    cartToken: l.cartToken ?? "",
    expiresAt: l.expiresAt ?? l.createdAt,
    paymentUrl: l.paymentUrl,
    rastreio: l.trackingCode,
    notaFiscal: l.invoiceNumber ? { numero: l.invoiceNumber, chave: l.invoiceKey } : null,
    createdAt: l.createdAt,
  };
}

export function createDrizzleOrderRepository(db: Database): OrderRepository {
  async function idDe(reference: string) {
    const [l] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.reference, reference))
      .limit(1);
    return l ?? null;
  }

  const repo: OrderRepository = {
    async criar(p) {
      const entrega = p.recebimento.tipo === "entrega" ? p.recebimento : null;

      return db.transaction(async (tx) => {
        const [linha] = await tx
          .insert(orders)
          .values({
            reference: p.reference,
            accessToken: p.accessToken,
            customerName: p.comprador.nome,
            customerEmail: p.comprador.email,
            customerPhone: p.comprador.telefone,
            customerDocument: p.comprador.cpf,
            deliveryMethod: p.recebimento.tipo,
            shippingPostalCode: entrega?.endereco.cep,
            shippingStreet: entrega?.endereco.rua,
            shippingNumber: entrega?.endereco.numero,
            shippingComplement: entrega?.endereco.complemento,
            shippingDistrict: entrega?.endereco.bairro,
            shippingCity: entrega?.endereco.cidade,
            shippingState: entrega?.endereco.uf,
            shippingServiceId: entrega?.frete.servicoId,
            shippingServiceName: entrega?.frete.servico,
            shippingCarrier: entrega?.frete.transportadora,
            shippingDeadlineDays: entrega?.frete.prazoDias,
            itemsTotalCents: p.itemsTotalCents,
            shippingCents: p.shippingCents,
            totalCents: p.totalCents,
            cartToken: p.cartToken,
            expiresAt: p.expiresAt,
          })
          .returning();

        const itens = await tx
          .insert(orderItems)
          .values(p.itens.map((i) => ({ ...i, orderId: linha.id })))
          .returning();

        await tx.insert(orderEvents).values({
          orderId: linha.id,
          fromStatus: null,
          toStatus: "aguardando_pagamento",
          note: "Pedido criado",
        });

        return paraPedido(linha, itens);
      });
    },

    async porReferencia(reference) {
      const [linha] = await db
        .select()
        .from(orders)
        .where(eq(orders.reference, reference))
        .limit(1);
      if (!linha) return null;

      const itens = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, linha.id));
      return paraPedido(linha, itens);
    },

    async eventos(reference): Promise<EventoDoPedido[]> {
      const pedido = await idDe(reference);
      if (!pedido) return [];
      return db
        .select({
          fromStatus: orderEvents.fromStatus,
          toStatus: orderEvents.toStatus,
          note: orderEvents.note,
          autor: orderEvents.authorId,
          createdAt: orderEvents.createdAt,
        })
        .from(orderEvents)
        .where(eq(orderEvents.orderId, pedido.id))
        .orderBy(asc(orderEvents.createdAt)) as Promise<EventoDoPedido[]>;
    },

    async definirUrlDePagamento(reference, url) {
      await db
        .update(orders)
        .set({ paymentUrl: url, updatedAt: new Date() })
        .where(eq(orders.reference, reference));
    },

    async transicionar(reference, de, para, nota, autor) {
      return db.transaction(async (tx) => {
        // Uma instrução só, com o status esperado no WHERE: o Postgres trava a
        // linha, e a segunda transação concorrente encontra o status já
        // trocado e não atualiza nada.
        const [trocado] = await tx
          .update(orders)
          .set({ status: para, updatedAt: new Date() })
          .where(and(eq(orders.reference, reference), eq(orders.status, de)))
          .returning({ id: orders.id });
        if (!trocado) return false;

        await tx.insert(orderEvents).values({
          orderId: trocado.id,
          fromStatus: de,
          toStatus: para,
          note: nota,
          authorId: autor ?? null,
        });
        return true;
      });
    },

    async anotar(reference, nota, autor) {
      const pedido = await idDe(reference);
      if (!pedido) return;
      await db.insert(orderEvents).values({
        orderId: pedido.id,
        fromStatus: pedido.status,
        toStatus: pedido.status,
        note: nota,
        authorId: autor ?? null,
      });
    },

    async definirRastreio(reference, codigo) {
      await db
        .update(orders)
        .set({ trackingCode: codigo, updatedAt: new Date() })
        .where(eq(orders.reference, reference));
    },

    async definirNotaFiscal(reference, nota) {
      await db
        .update(orders)
        .set({ invoiceNumber: nota?.numero ?? null, invoiceKey: nota?.chave ?? null, updatedAt: new Date() })
        .where(eq(orders.reference, reference));
    },

    async registrarPagamento(reference, provedor, pagamento) {
      const pedido = await idDe(reference);
      if (!pedido) return;
      await db
        .insert(payments)
        .values({
          orderId: pedido.id,
          provider: provedor,
          providerPaymentId: pagamento.providerPaymentId,
          status: pagamento.status,
          method: pagamento.metodo,
          amountCents: pagamento.valorCents,
        })
        .onConflictDoUpdate({
          target: [payments.provider, payments.providerPaymentId],
          set: {
            status: pagamento.status,
            method: pagamento.metodo,
            amountCents: pagamento.valorCents,
            updatedAt: new Date(),
          },
        });
    },

    async vencidos(agora) {
      const linhas = await db
        .select({ reference: orders.reference })
        .from(orders)
        .where(
          and(
            eq(orders.status, "aguardando_pagamento"),
            lte(orders.expiresAt, agora),
          ),
        );
      return linhas.map((l) => l.reference);
    },
  };

  return repo;
}
