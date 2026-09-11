import { describe, it, expect } from "vitest";
import { parseTireSize, formatTireSize, tireSizeSlug } from "./tire-size";

describe("parseTireSize", () => {
  it("lê a medida completa com índices", () => {
    const r = parseTireSize("205/55 R16 91V");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      width: 205,
      profile: 55,
      rim: 16,
      loadIndex: 91,
      speedRating: "V",
    });
  });

  it("lê a medida sem os índices", () => {
    const r = parseTireSize("175/70 R14");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.loadIndex).toBeNull();
    expect(r.value.speedRating).toBeNull();
  });

  it("aceita as formas que o cliente digita na busca", () => {
    for (const entrada of ["205/55r16", "205 55 16", "205/55-R16"]) {
      const r = parseTireSize(entrada);
      expect(r.ok, `falhou em "${entrada}"`).toBe(true);
      if (!r.ok) continue;
      expect(r.value.width).toBe(205);
      expect(r.value.profile).toBe(55);
      expect(r.value.rim).toBe(16);
    }
  });

  it("rejeita medida fora da faixa fisicamente possível", () => {
    expect(parseTireSize("999/55 R16").ok).toBe(false);
    expect(parseTireSize("205/99 R16").ok).toBe(false);
    expect(parseTireSize("205/55 R99").ok).toBe(false);
  });

  it("rejeita entrada que não é medida", () => {
    expect(parseTireSize("michelin").ok).toBe(false);
    expect(parseTireSize("").ok).toBe(false);
  });
});

describe("formatTireSize", () => {
  it("formata no padrão que o cliente reconhece", () => {
    const r = parseTireSize("205/55r16 91v");
    if (!r.ok) throw new Error("parse falhou");
    expect(formatTireSize(r.value)).toBe("205/55 R16 91V");
  });
});

describe("tireSizeSlug", () => {
  it("gera slug estável para a URL da faceta", () => {
    const r = parseTireSize("205/55 R16 91V");
    if (!r.ok) throw new Error("parse falhou");
    expect(tireSizeSlug(r.value)).toBe("205-55-r16");
  });
});
