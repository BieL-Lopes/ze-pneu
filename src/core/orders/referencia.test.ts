import { describe, it, expect } from "vitest";
import { gerarReferencia, gerarTokenDeAcesso } from "./referencia";

describe("gerarReferencia", () => {
  it("tem o formato ZP- seguido de 8 caracteres sem ambiguidade", () => {
    for (let i = 0; i < 200; i++) {
      // Sem 0/O, 1/I/L: o cliente dita a referência no WhatsApp.
      expect(gerarReferencia()).toMatch(/^ZP-[2-9A-HJKMNP-Z]{8}$/);
    }
  });

  it("não repete em sequência", () => {
    const vistas = new Set(Array.from({ length: 1000 }, gerarReferencia));
    expect(vistas.size).toBe(1000);
  });
});

describe("gerarTokenDeAcesso", () => {
  it("é longo o bastante para não ser adivinhado e seguro para URL", () => {
    const token = gerarTokenDeAcesso();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gerarTokenDeAcesso()).not.toBe(token);
  });
});
