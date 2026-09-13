import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  limparDadosDeTeste,
  semearCatalogo,
  type CatalogoDeTeste,
} from "../helpers/db";
import { GET } from "@/app/api/v1/products/route";

let cat: CatalogoDeTeste;

beforeEach(async () => {
  await limparDadosDeTeste();
  cat = await semearCatalogo();
});

afterAll(limparDadosDeTeste);

/**
 * A suíte roda no mesmo banco dos dados reais, então toda requisição filtra
 * pelas marcas criadas por este teste.
 */
function requisicao(extra = "") {
  const marcas = `${cat.slugs.marca},${cat.slugs.outraMarca}`;
  return new Request(
    `http://localhost:3000/api/v1/products?marca=${encodeURIComponent(marcas)}${extra}`,
  );
}

describe("GET /api/v1/products", () => {
  it("devolve o catálogo com metadados de paginação", async () => {
    const res = await GET(requisicao());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(24);
    expect(body.items).toHaveLength(2);
  });

  it("aplica os filtros da query string", async () => {
    const res = await GET(
      new Request(
        `http://localhost:3000/api/v1/products?marca=${encodeURIComponent(cat.slugs.outraMarca)}`,
      ),
    );
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].slug).toBe(cat.slugs.cinturato);
  });

  it("entende medida colada na busca", async () => {
    const res = await GET(requisicao("&q=195%2F75%20R15"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].slug).toBe(cat.slugs.primacy);
  });

  it("devolve facetas", async () => {
    const res = await GET(requisicao());
    const body = await res.json();
    expect(body.facets.brands).toHaveLength(2);
  });
});
