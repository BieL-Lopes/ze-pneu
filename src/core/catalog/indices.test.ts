import { describe, it, expect } from "vitest";
import { cargaMaximaKg, velocidadeMaximaKmh } from "./indices";

describe("cargaMaximaKg", () => {
  it.each([
    [69, 325],
    [84, 500],
    [91, 615],
    [99, 775],
    [100, 800],
    [112, 1120],
    [114, 1180],
  ])("índice %i suporta %i kg por pneu", (indice, kg) => {
    expect(cargaMaximaKg(indice)).toBe(kg);
  });

  it("fora da tabela devolve null em vez de inventar", () => {
    expect(cargaMaximaKg(10)).toBeNull();
    expect(cargaMaximaKg(200)).toBeNull();
  });
});

describe("velocidadeMaximaKmh", () => {
  it.each([
    ["R", 170],
    ["T", 190],
    ["H", 210],
    ["V", 240],
    ["W", 270],
    ["Y", 300],
  ])("%s vai até %i km/h", (simbolo, kmh) => {
    expect(velocidadeMaximaKmh(simbolo)).toBe(kmh);
  });

  it("aceita minúscula", () => {
    expect(velocidadeMaximaKmh("v")).toBe(240);
  });

  it("símbolo desconhecido devolve null", () => {
    expect(velocidadeMaximaKmh("X")).toBeNull();
  });
});
