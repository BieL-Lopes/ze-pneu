import { describe, it, expect, beforeEach } from "vitest";
import { limparBanco, semearCatalogo } from "../helpers/db";
import { GET } from "@/app/api/v1/products/route";

beforeEach(async () => {
  await limparBanco();
  await semearCatalogo();
});

function requisicao(qs = "") {
  return new Request(`http://localhost:3000/api/v1/products${qs}`);
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
    const res = await GET(requisicao("?marca=pirelli"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].brandName).toBe("Pirelli");
  });

  it("entende medida colada na busca", async () => {
    const res = await GET(requisicao("?q=195%2F75%20R15"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].slug).toBe("michelin-primacy-4");
  });

  it("devolve facetas", async () => {
    const res = await GET(requisicao());
    const body = await res.json();
    expect(body.facets.brands).toHaveLength(2);
  });
});
