import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb, limparBanco, semearCatalogo } from "../helpers/db";
import * as schema from "@/db/schema";
import { createDrizzleProductRepository } from "@/db/repositories/drizzle-product-repository";

const repo = createDrizzleProductRepository(testDb);
const base = { page: 1, perPage: 20 };

beforeEach(async () => {
  await limparBanco();
  await semearCatalogo();
});

describe("search", () => {
  it("devolve todos os produtos ativos", async () => {
    const r = await repo.search(base);
    expect(r.total).toBe(2);
    expect(r.items.map((i) => i.slug).sort()).toEqual([
      "michelin-primacy-4",
      "pirelli-cinturato-p7",
    ]);
  });

  it("mostra o menor preço entre as variantes", async () => {
    const r = await repo.search(base);
    const primacy = r.items.find((i) => i.slug === "michelin-primacy-4");
    expect(primacy?.fromPriceCents).toBe(52000);
  });

  it("filtra por medida", async () => {
    const r = await repo.search({
      ...base,
      widths: [205],
      profiles: [55],
      rims: [16],
    });
    expect(r.total).toBe(2);

    const so195 = await repo.search({ ...base, widths: [195] });
    expect(so195.total).toBe(1);
    expect(so195.items[0].slug).toBe("michelin-primacy-4");
  });

  it("filtra por marca", async () => {
    const r = await repo.search({ ...base, brandSlugs: ["pirelli"] });
    expect(r.total).toBe(1);
    expect(r.items[0].brandName).toBe("Pirelli");
  });

  it("busca por texto no nome e na marca", async () => {
    const r = await repo.search({ ...base, query: "primacy" });
    expect(r.total).toBe(1);
    expect(r.items[0].slug).toBe("michelin-primacy-4");
  });

  it("conta facetas sobre o resultado filtrado", async () => {
    const r = await repo.search({ ...base, widths: [205] });
    const aro16 = r.facets.rims.find((f) => f.value === "16");
    expect(aro16?.count).toBe(2);
    expect(r.facets.brands).toHaveLength(2);
  });

  it("pagina", async () => {
    const r = await repo.search({ ...base, perPage: 1 });
    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(2);
  });

  it("devolve resultado vazio quando nada casa com o filtro", async () => {
    const r = await repo.search({ ...base, brandSlugs: ["inexistente"] });
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
  });

  it("esconde produto que não está ativo", async () => {
    await testDb
      .update(schema.products)
      .set({ status: "draft" })
      .where(eq(schema.products.slug, "pirelli-cinturato-p7"));

    const r = await repo.search(base);
    expect(r.total).toBe(1);
    expect(r.items[0].slug).toBe("michelin-primacy-4");
  });
});

describe("findBySlug", () => {
  it("devolve o produto com variantes e mídia", async () => {
    const p = await repo.findBySlug("michelin-primacy-4");
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Primacy 4");
    expect(p!.brandName).toBe("Michelin");
    expect(p!.variants).toHaveLength(2);
    expect(p!.media[0].url).toBe("https://exemplo.test/primacy.jpg");
  });

  it("formata a medida da variante para exibição", async () => {
    const p = await repo.findBySlug("michelin-primacy-4");
    const medidas = p!.variants.map((v) => v.sizeLabel).sort();
    expect(medidas).toEqual(["195/75 R15 88H", "205/55 R16 91V"]);
  });

  it("devolve null quando não existe", async () => {
    expect(await repo.findBySlug("nao-existe")).toBeNull();
  });
});
