import { describe, it, expect } from "vitest";
import { formatarCep, normalizarCep } from "./cep";

describe("normalizarCep", () => {
  it("aceita com e sem hífen e devolve só dígitos", () => {
    expect(normalizarCep("70040-010")).toBe("70040010");
    expect(normalizarCep("70040010")).toBe("70040010");
    expect(normalizarCep(" 70.040-010 ")).toBe("70040010");
  });

  it("recusa tamanho errado e zeros", () => {
    expect(normalizarCep("7004001")).toBeNull();
    expect(normalizarCep("00000000")).toBeNull();
    expect(normalizarCep("")).toBeNull();
  });
});

describe("formatarCep", () => {
  it("põe o hífen", () => {
    expect(formatarCep("70040010")).toBe("70040-010");
  });
});
