import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  testDb,
  limparDadosDeTeste,
  semearCatalogo,
  localPadrao,
  idDeTeste,
  type CatalogoDeTeste,
} from "../helpers/db";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";
import { createDrizzleCartRepository } from "@/db/repositories/drizzle-cart-repository";

let repo: ReturnType<typeof createDrizzleCartRepository>;
let estoque: ReturnType<typeof createDrizzleStockRepository>;
let cat: CatalogoDeTeste;
let variantId: string;
let token: string;

beforeEach(async () => {
  await limparDadosDeTeste();
  cat = await semearCatalogo();
  variantId = cat.variantes[0].id;
  token = idDeTeste();

  const local = await localPadrao();
  estoque = createDrizzleStockRepository(testDb, local.id);
  repo = createDrizzleCartRepository(testDb, estoque);

  await estoque.registrarEntrada({
    variantId,
    quantity: 5,
    reason: "estoque inicial",
    authorId: "teste",
  });
  await estoque.registrarEntrada({
    variantId: cat.variantes[1].id,
    quantity: 5,
    reason: "estoque inicial",
    authorId: "teste",
  });
});

afterAll(limparDadosDeTeste);

describe("obterOuCriar", () => {
  it("cria carrinho vazio na primeira visita", async () => {
    const c = await repo.obterOuCriar(token);
    expect(c.token).toBe(token);
    expect(c.itens).toEqual([]);
  });

  it("devolve o mesmo carrinho na segunda visita", async () => {
    const a = await repo.obterOuCriar(token);
    const b = await repo.obterOuCriar(token);
    expect(b.id).toBe(a.id);
  });
});

describe("definirItem", () => {
  it("adiciona item com dados do produto e disponibilidade", async () => {
    const c = await repo.definirItem(token, variantId, 2);

    expect(c.itens).toHaveLength(1);
    expect(c.itens[0].quantity).toBe(2);
    expect(c.itens[0].sku).toBe(cat.variantes[0].sku);
    expect(c.itens[0].productName).toBe("Primacy 4");
    expect(c.itens[0].sizeLabel).toBe("205/55 R16 91V");
    expect(c.itens[0].unitPriceCents).toBe(65000);
    expect(c.itens[0].disponivel).toBe(5);
  });

  it("define quantidade absoluta, não incrementa", async () => {
    await repo.definirItem(token, variantId, 2);
    const c = await repo.definirItem(token, variantId, 3);
    expect(c.itens).toHaveLength(1);
    expect(c.itens[0].quantity).toBe(3);
  });

  it("corta a quantidade no estoque disponível", async () => {
    const c = await repo.definirItem(token, variantId, 99);
    expect(c.itens[0].quantity).toBe(5);
  });

  it("desconta a reserva de outro pedido ao calcular o disponível", async () => {
    await estoque.reservar({
      orderRef: idDeTeste(),
      itens: [{ variantId, quantity: 3 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const c = await repo.definirItem(token, variantId, 99);
    expect(c.itens[0].quantity).toBe(2);
    expect(c.itens[0].disponivel).toBe(2);
  });

  it("quantidade zero remove o item", async () => {
    await repo.definirItem(token, variantId, 2);
    const c = await repo.definirItem(token, variantId, 0);
    expect(c.itens).toEqual([]);
  });

  it("mantém itens de carrinhos diferentes separados", async () => {
    const outroToken = idDeTeste();
    await repo.definirItem(token, variantId, 2);
    const outro = await repo.obterOuCriar(outroToken);
    expect(outro.itens).toEqual([]);
  });
});

describe("remover e limpar", () => {
  it("remove um item", async () => {
    await repo.definirItem(token, variantId, 2);
    const c = await repo.remover(token, variantId);
    expect(c.itens).toEqual([]);
  });

  it("limpa o carrinho inteiro", async () => {
    await repo.definirItem(token, variantId, 2);
    await repo.definirItem(token, cat.variantes[1].id, 1);
    await repo.limpar(token);

    const c = await repo.obterOuCriar(token);
    expect(c.itens).toEqual([]);
  });
});
