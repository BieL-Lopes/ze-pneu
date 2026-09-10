import { describe, it, expect, vi } from "vitest";
import { createCatalogService } from "./catalog-service";
import type { ProductRepository } from "./product-repository";
import type { CatalogFilters, SearchResult } from "./types";

const vazio: SearchResult = {
  items: [],
  total: 0,
  facets: { brands: [], widths: [], profiles: [], rims: [], vehicleTypes: [] },
};

function repoFalso() {
  const search = vi.fn<(f: CatalogFilters) => Promise<SearchResult>>(
    async () => vazio,
  );
  const findBySlug = vi.fn(async () => null);
  return { search, findBySlug } satisfies ProductRepository;
}

const base: CatalogFilters = { page: 1, perPage: 24 };

describe("listar", () => {
  it("converte busca por medida em filtro estruturado", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).listar({ ...base, query: "205/55 R16" });

    const usado = repo.search.mock.calls[0][0];
    expect(usado.widths).toEqual([205]);
    expect(usado.profiles).toEqual([55]);
    expect(usado.rims).toEqual([16]);
    expect(usado.query).toBeUndefined();
  });

  it("aceita a medida do jeito que o cliente digita", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).listar({ ...base, query: "205 55 16" });
    expect(repo.search.mock.calls[0][0].rims).toEqual([16]);
  });

  it("mantém como texto o que não é medida", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).listar({ ...base, query: "michelin" });

    const usado = repo.search.mock.calls[0][0];
    expect(usado.query).toBe("michelin");
    expect(usado.widths).toBeUndefined();
  });

  it("não sobrescreve filtro de medida já escolhido nas facetas", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).listar({
      ...base,
      query: "205/55 R16",
      rims: [17],
    });
    expect(repo.search.mock.calls[0][0].rims).toEqual([17]);
  });

  it("repassa o resultado do repositório", async () => {
    const repo = repoFalso();
    const r = await createCatalogService(repo).listar(base);
    expect(r).toBe(vazio);
  });
});

describe("detalhe", () => {
  it("delega ao repositório", async () => {
    const repo = repoFalso();
    await createCatalogService(repo).detalhe("michelin-primacy-4");
    expect(repo.findBySlug).toHaveBeenCalledWith("michelin-primacy-4");
  });
});
