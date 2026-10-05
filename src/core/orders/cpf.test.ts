import { describe, it, expect } from "vitest";
import { normalizarCpf } from "./cpf";

describe("normalizarCpf", () => {
  it("aceita CPF válido com ou sem pontuação e devolve só dígitos", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
    expect(normalizarCpf("52998224725")).toBe("52998224725");
    expect(normalizarCpf(" 529 982 247 25 ")).toBe("52998224725");
  });

  it("recusa dígito verificador errado", () => {
    expect(normalizarCpf("529.982.247-24")).toBeNull();
  });

  it("recusa sequência repetida, que passa no cálculo mas não existe", () => {
    expect(normalizarCpf("111.111.111-11")).toBeNull();
    expect(normalizarCpf("00000000000")).toBeNull();
  });

  it("recusa tamanho errado", () => {
    expect(normalizarCpf("5299822472")).toBeNull();
    expect(normalizarCpf("")).toBeNull();
  });
});
