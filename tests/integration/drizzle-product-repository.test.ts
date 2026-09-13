import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  testDb,
  limparDadosDeTeste,
  semearCatalogo,
  type CatalogoDeTeste,
} from "../helpers/db";
import * as schema from "@/db/schema";
import { createDrizzleProductRepository } from "@/db/repositories/drizzle-product-repository";

const repo = createDrizzleProductRepository(testDb);

let cat: CatalogoDeTeste;
/**
 * Filtro que restringe a busca ao catálogo deste teste.
 *
 * A suíte roda no mesmo banco dos dados reais, então uma busca sem filtro
 * traria também os produtos do cliente e as contagens não fechariam.
 */
let base: { page: number; perPage: number; brandSlugs: string[] };

beforeEach(async () => {
  await limparDadosDeTeste();
  cat = await semearCatalogo();
  base = {
    page: 1,
    perPage: 20,
    brandSlugs: [cat.slugs.marca, cat.slugs.outraMarca],
  };
});

afterAll(limparDadosDeTeste);

describe("search", () => {
  it("devolve os produtos ativos", async () => {
    const r = await repo.search(base);
    expect(r.total).toBe(2);
    expect(r.items.map((i) => i.slug).sort()).toEqual(
      [cat.slugs.primacy, cat.slugs.cinturato].sort(),
    );
  });

  it("mostra o menor preço entre as variantes", async () => {
    const r = await repo.search(base);
    const primacy = r.items.find((i) => i.slug === cat.slugs.primacy);
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
    expect(so195.items[0].slug).toBe(cat.slugs.primacy);
  });

  it("filtra por marca", async () => {
    const r = await repo.search({ ...base, brandSlugs: [cat.slugs.outraMarca] });
    expect(r.total).toBe(1);
    expect(r.items[0].slug).toBe(cat.slugs.cinturato);
  });

  it("busca por texto no nome", async () => {
    const r = await repo.search({ ...base, query: "primacy" });
    expect(r.total).toBe(1);
    expect(r.items[0].slug).toBe(cat.slugs.primacy);
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
    const r = await repo.search({ ...base, brandSlugs: ["marca-inexistente"] });
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
  });

  it("esconde produto que não está ativo", async () => {
    await testDb
      .update(schema.products)
      .set({ status: "draft" })
      .where(eq(schema.products.slug, cat.slugs.cinturato));

    const r = await repo.search(base);
    expect(r.total).toBe(1);
    expect(r.items[0].slug).toBe(cat.slugs.primacy);
  });
});

describe("findBySlug", () => {
  it("devolve o produto com variantes e mídia", async () => {
    const p = await repo.findBySlug(cat.slugs.primacy);
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Primacy 4");
    expect(p!.brandName).toContain("Michelin");
    expect(p!.variants).toHaveLength(2);
    expect(p!.media[0].url).toBe("https://exemplo.test/primacy.jpg");
  });

  it("formata a medida da variante para exibição", async () => {
    const p = await repo.findBySlug(cat.slugs.primacy);
    const medidas = p!.variants.map((v) => v.sizeLabel).sort();
    expect(medidas).toEqual(["195/75 R15 88H", "205/55 R16 91V"]);
  });

  it("devolve null quando não existe", async () => {
    expect(await repo.findBySlug("nao-existe-mesmo")).toBeNull();
  });
});
