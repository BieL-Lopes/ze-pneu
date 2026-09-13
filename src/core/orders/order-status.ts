import { type Result, ok, err } from "@/core/shared/result";

export type OrderStatus =
  | "aguardando_pagamento"
  | "pago"
  | "em_separacao"
  | "enviado"
  | "pronto_para_retirada"
  | "entregue"
  | "retirado"
  | "cancelado"
  | "estornado";

/**
 * Único lugar onde as transições são declaradas.
 *
 * Entrega e retirada são caminhos separados de propósito: um pedido despachado
 * pelos Correios não pode virar "retirado", e um pedido separado para retirada
 * não pode virar "entregue". Misturar os dois faria o rastreio mentir para o
 * cliente e para a operação.
 */
export const transicoesValidas: Record<OrderStatus, OrderStatus[]> = {
  aguardando_pagamento: ["pago", "cancelado"],
  pago: ["em_separacao", "cancelado", "estornado"],
  em_separacao: ["enviado", "pronto_para_retirada", "cancelado", "estornado"],
  enviado: ["entregue", "estornado"],
  pronto_para_retirada: ["retirado", "estornado"],
  entregue: [],
  retirado: [],
  cancelado: [],
  estornado: [],
};

export const ROTULO_STATUS: Record<OrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  em_separacao: "Em separação",
  enviado: "Enviado",
  pronto_para_retirada: "Pronto para retirada",
  entregue: "Entregue",
  retirado: "Retirado",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

export function podeTransicionar(de: OrderStatus, para: OrderStatus): boolean {
  return transicoesValidas[de].includes(para);
}

export function transicionar(
  de: OrderStatus,
  para: OrderStatus,
): Result<OrderStatus> {
  if (!podeTransicionar(de, para)) {
    return err(
      `Transição inválida: pedido "${ROTULO_STATUS[de]}" não pode ir para "${ROTULO_STATUS[para]}"`,
    );
  }
  return ok(para);
}

export function eFinal(status: OrderStatus): boolean {
  return transicoesValidas[status].length === 0;
}
