import { describe, it, expect } from "vitest";
import { formatBRL } from "./format";

// Intl usa espaço não-quebrável (U+00A0) depois do "R$". Normalizamos para
// espaço comum, senão a asserção falha por um caractere invisível.
const normalizar = (s: string) => s.replace(/ /g, " ");

describe("formatBRL", () => {
  it("formata centavos como moeda brasileira", () => {
    expect(normalizar(formatBRL(65000))).toBe("R$ 650,00");
  });

  it("formata valor quebrado", () => {
    expect(normalizar(formatBRL(52990))).toBe("R$ 529,90");
  });

  it("formata milhar com separador brasileiro", () => {
    expect(normalizar(formatBRL(125090))).toBe("R$ 1.250,90");
  });

  it("formata zero", () => {
    expect(normalizar(formatBRL(0))).toBe("R$ 0,00");
  });
});
