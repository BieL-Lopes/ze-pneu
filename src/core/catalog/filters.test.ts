import { describe, it, expect } from "vitest";
import { parseFilters, filtersToSearchParams } from "./filters";

describe("parseFilters", () => {
  it("usa página 1 e 24 por página como padrão", () => {
    const f = parseFilters({});
    expect(f.page).toBe(1);
    expect(f.perPage).toBe(24);
  });

  it("lê valores múltiplos separados por vírgula", () => {
    const f = parseFilters({ aro: "15,16,17" });
    expect(f.rims).toEqual([15, 16, 17]);
  });

  it("lê valores múltiplos repetidos", () => {
    const f = parseFilters({ marca: ["michelin", "pirelli"] });
    expect(f.brandSlugs).toEqual(["michelin", "pirelli"]);
  });

  it("converte preço de reais para centavos", () => {
    const f = parseFilters({ preco_min: "300", preco_max: "900" });
    expect(f.minPriceCents).toBe(30000);
    expect(f.maxPriceCents).toBe(90000);
  });

  it("descarta número inválido em vez de quebrar a página", () => {
    const f = parseFilters({ aro: "abc,16", pagina: "-3" });
    expect(f.rims).toEqual([16]);
    expect(f.page).toBe(1);
  });

  it("limita perPage para impedir varredura do catálogo inteiro", () => {
    expect(parseFilters({ por_pagina: "5000" }).perPage).toBe(96);
  });

  it("lê a busca textual", () => {
    expect(parseFilters({ q: "primacy" }).query).toBe("primacy");
  });
});

describe("filtersToSearchParams", () => {
  it("faz a volta sem perder informação", () => {
    const original = parseFilters({
      aro: "16",
      marca: "michelin",
      q: "primacy",
      pagina: "2",
    });
    const refeito = parseFilters(
      Object.fromEntries(filtersToSearchParams(original)),
    );
    expect(refeito).toEqual(original);
  });

  it("omite os padrões para manter a URL limpa", () => {
    const params = filtersToSearchParams(parseFilters({}));
    expect(params.toString()).toBe("");
  });
});
