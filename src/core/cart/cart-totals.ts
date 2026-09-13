import type { CartItem, CartTotals } from "./types";

/** Trava contra erro de digitação e contra revenda disfarçada de varejo. */
export const LIMITE_POR_ITEM = 20;

export function calcularTotais(itens: CartItem[]): CartTotals {
  let itemsTotalCents = 0;
  let quantidadeTotal = 0;
  let temItemIndisponivel = false;

  for (const item of itens) {
    itemsTotalCents += item.unitPriceCents * item.quantity;
    quantidadeTotal += item.quantity;
    if (item.quantity > item.disponivel) temItemIndisponivel = true;
  }

  return { itemsTotalCents, quantidadeTotal, temItemIndisponivel };
}

/**
 * Quantidade que o carrinho realmente aceita.
 *
 * Corta no estoque e no limite por item em vez de rejeitar: quem pede 9 e só
 * tem 4 prefere levar 4 a receber um erro e ter que recomeçar.
 */
export function normalizarQuantidade(
  pedida: number,
  disponivel: number,
): number {
  const inteira = Math.floor(pedida);
  if (!Number.isFinite(inteira) || inteira < 0) return 0;
  return Math.max(0, Math.min(inteira, disponivel, LIMITE_POR_ITEM));
}
