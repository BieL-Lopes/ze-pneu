import { describe, it, expect } from "vitest";
import {
  calcularTotais,
  normalizarQuantidade,
  LIMITE_POR_ITEM,
} from "./cart-totals";
import type { CartItem } from "./types";

function item(over: Partial<CartItem> = {}): CartItem {
  return {
    variantId: "v1",
    sku: "SKU-1",
    productName: "Primacy 4",
    productSlug: "michelin-primacy-4",
    sizeLabel: "205/55 R16 91V",
    unitPriceCents: 65000,
    quantity: 1,
    disponivel: 10,
    ...over,
  };
}

describe("calcularTotais", () => {
  it("carrinho vazio soma zero", () => {
    const t = calcularTotais([]);
    expect(t.itemsTotalCents).toBe(0);
    expect(t.quantidadeTotal).toBe(0);
    expect(t.temItemIndisponivel).toBe(false);
  });

  it("multiplica preço por quantidade", () => {
    const t = calcularTotais([item({ quantity: 4 })]);
    expect(t.itemsTotalCents).toBe(260000);
    expect(t.quantidadeTotal).toBe(4);
  });

  it("soma itens diferentes", () => {
    const t = calcularTotais([
      item({ variantId: "v1", quantity: 2, unitPriceCents: 65000 }),
      item({ variantId: "v2", quantity: 1, unitPriceCents: 58000 }),
    ]);
    expect(t.itemsTotalCents).toBe(188000);
    expect(t.quantidadeTotal).toBe(3);
  });

  it("aponta quando algum item passou do estoque", () => {
    const t = calcularTotais([item({ quantity: 5, disponivel: 2 })]);
    expect(t.temItemIndisponivel).toBe(true);
  });

  it("não aponta indisponível quando tudo cabe", () => {
    const t = calcularTotais([item({ quantity: 2, disponivel: 2 })]);
    expect(t.temItemIndisponivel).toBe(false);
  });
});

describe("normalizarQuantidade", () => {
  it("mantém quantidade válida", () => {
    expect(normalizarQuantidade(3, 10)).toBe(3);
  });

  it("corta no estoque disponível", () => {
    expect(normalizarQuantidade(9, 4)).toBe(4);
  });

  it("corta no limite por item", () => {
    expect(normalizarQuantidade(999, 500)).toBe(LIMITE_POR_ITEM);
  });

  it("nunca devolve menos que zero", () => {
    expect(normalizarQuantidade(-5, 10)).toBe(0);
    expect(normalizarQuantidade(3, 0)).toBe(0);
  });

  it("arredonda fração para baixo", () => {
    expect(normalizarQuantidade(2.7, 10)).toBe(2);
  });
});
