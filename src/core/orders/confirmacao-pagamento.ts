import type { CartRepository } from "@/core/cart/cart-repository";
import type { StockRepository } from "@/core/stock/stock-repository";
import type { PaymentProvider } from "@/core/payment/payment-provider";
import { type Result, ok, err } from "@/core/shared/result";
import type { OrderRepository } from "./order-repository";
import { podeTransicionar } from "./order-status";

function reais(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

type Dependencias = {
  pedidos: OrderRepository;
  estoque: Pick<StockRepository, "consumirReserva">;
  carrinhos: Pick<CartRepository, "limpar">;
  pagamento: PaymentProvider;
};

/**
 * Processa o aviso de mudança de um pagamento.
 *
 * O aviso só diz "o pagamento X mudou". O status e o valor vêm de uma consulta
 * ao provedor, nunca do corpo do aviso — que qualquer um poderia forjar.
 *
 * É seguro processar o mesmo pagamento várias vezes, inclusive ao mesmo tempo:
 * a baixa de estoque só acontece para quem vence a troca condicional de
 * "aguardando pagamento" para "pago".
 */
export function createConfirmacaoDePagamento(deps: Dependencias) {
  return {
    async processar(providerPaymentId: string): Promise<Result<string, string>> {
      const pagamento = await deps.pagamento.consultarPagamento(providerPaymentId);
      if (!pagamento) return err(`Pagamento ${providerPaymentId} não encontrado no provedor`);
      if (!pagamento.orderRef) return ok("Pagamento sem referência de pedido: ignorado");

      const ref = pagamento.orderRef;
      const pedido = await deps.pedidos.porReferencia(ref);
      if (!pedido) return ok(`Pedido ${ref} não existe: ignorado`);

      await deps.pedidos.registrarPagamento(ref, deps.pagamento.nome, pagamento);
      const id = pagamento.providerPaymentId;

      if (pagamento.status === "aprovado") {
        if (pedido.status === "cancelado") {
          await deps.pedidos.anotar(
            ref,
            `Pagamento ${id} aprovado com o pedido já cancelado: estornar no provedor.`,
          );
          console.error(`Pagamento ${id} aprovado para pedido cancelado ${ref}`);
          return ok("Aprovado para pedido cancelado: estorno manual");
        }

        if (pagamento.valorCents !== pedido.totalCents) {
          await deps.pedidos.anotar(
            ref,
            `Pagamento ${id} aprovado com valor ${reais(pagamento.valorCents)}, diferente do total ${reais(pedido.totalCents)}. Conferir antes de separar.`,
          );
          console.error(`Valor divergente no pagamento ${id} do pedido ${ref}`);
          return ok("Valor divergente: pedido mantido aguardando");
        }

        const venceu = await deps.pedidos.transicionar(
          ref,
          "aguardando_pagamento",
          "pago",
          `Pagamento ${id} aprovado (${pagamento.metodo ?? "meio não informado"})`,
        );
        if (!venceu) return ok("Já processado");

        const baixa = await deps.estoque.consumirReserva(ref);
        if (!baixa.ok) {
          await deps.pedidos.anotar(
            ref,
            "Pago, mas a reserva de estoque não existia mais. Conferir o estoque antes de separar.",
          );
          console.error(`Pedido ${ref} pago sem reserva ativa`);
        }

        await deps.carrinhos.limpar(pedido.cartToken);
        return ok("Pago");
      }

      if (pagamento.status === "estornado" && podeTransicionar(pedido.status, "estornado")) {
        await deps.pedidos.transicionar(ref, pedido.status, "estornado", `Pagamento ${id} estornado`);
        return ok("Estornado");
      }

      // Pendente ou recusado: o cliente ainda pode pagar por outro meio na
      // mesma cobrança. Se desistir, a expiração devolve o estoque.
      return ok(`Status ${pagamento.status}: registrado`);
    },
  };
}
