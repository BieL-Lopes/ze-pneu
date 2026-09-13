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

let repo: ReturnType<typeof createDrizzleStockRepository>;
let cat: CatalogoDeTeste;
let variantId: string;
let outraVarianteId: string;

beforeEach(async () => {
  await limparDadosDeTeste();
  cat = await semearCatalogo();
  variantId = cat.variantes[0].id;
  outraVarianteId = cat.variantes[2].id;

  const local = await localPadrao();
  repo = createDrizzleStockRepository(testDb, local.id);
});

afterAll(limparDadosDeTeste);

describe("entrada e disponibilidade", () => {
  it("SKU sem movimento tem disponibilidade zero", async () => {
    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(0);
    expect(d.disponivel).toBe(0);
  });

  it("entrada aumenta o saldo e grava movimento", async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 10,
      reason: "Compra nota 123",
      authorId: "admin",
    });

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(10);
    expect(d.disponivel).toBe(10);

    const extrato = await repo.extrato(variantId);
    expect(extrato).toHaveLength(1);
    expect(extrato[0].kind).toBe("entrada");
    expect(extrato[0].quantity).toBe(10);
    expect(extrato[0].reason).toBe("Compra nota 123");
  });

  it("ajuste com motivo fica registrado no extrato", async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 5,
      reason: "entrada",
      authorId: "admin",
    });
    await repo.ajustar({
      variantId,
      delta: -2,
      reason: "Quebra no transporte",
      authorId: "admin",
    });

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(3);

    const extrato = await repo.extrato(variantId);
    const ajuste = extrato.find((m) => m.kind === "ajuste");
    expect(ajuste?.quantity).toBe(-2);
    expect(ajuste?.reason).toBe("Quebra no transporte");
  });
});

describe("reserva", () => {
  beforeEach(async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 3,
      reason: "estoque inicial",
      authorId: "admin",
    });
  });

  it("reserva reduz o disponível sem reduzir o físico", async () => {
    const r = await repo.reservar({
      orderRef: idDeTeste(),
      itens: [{ variantId, quantity: 2 }],
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(r.ok).toBe(true);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(3);
    expect(d.reserved).toBe(2);
    expect(d.disponivel).toBe(1);
  });

  it("recusa reserva acima do disponível e diz o que tem", async () => {
    const r = await repo.reservar({
      orderRef: idDeTeste(),
      itens: [{ variantId, quantity: 4 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tipo).toBe("indisponivel");
    if (r.error.tipo !== "indisponivel") return;
    expect(r.error.pedido).toBe(4);
    expect(r.error.disponivel).toBe(3);
  });

  it("não reserva nada quando um item do pedido falta", async () => {
    const r = await repo.reservar({
      orderRef: idDeTeste(),
      itens: [
        { variantId, quantity: 1 },
        { variantId: outraVarianteId, quantity: 1 },
      ],
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(r.ok).toBe(false);

    // O primeiro item não pode ter ficado reservado.
    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.reserved).toBe(0);
    expect(d.disponivel).toBe(3);
  });

  it("consumir a reserva baixa o físico", async () => {
    const orderRef = idDeTeste();
    await repo.reservar({
      orderRef,
      itens: [{ variantId, quantity: 2 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const r = await repo.consumirReserva(orderRef);
    expect(r.ok).toBe(true);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(1);
    expect(d.reserved).toBe(0);
    expect(d.disponivel).toBe(1);
  });

  it("consumir reserva que não existe falha em vez de baixar nada", async () => {
    const r = await repo.consumirReserva(idDeTeste());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tipo).toBe("reserva_inexistente");
  });

  it("liberar a reserva devolve o disponível", async () => {
    const orderRef = idDeTeste();
    await repo.reservar({
      orderRef,
      itens: [{ variantId, quantity: 2 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    await repo.liberarReserva(orderRef);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.onHand).toBe(3);
    expect(d.reserved).toBe(0);
    expect(d.disponivel).toBe(3);
  });

  it("libera reservas vencidas e não toca nas vivas", async () => {
    await repo.reservar({
      orderRef: idDeTeste(),
      itens: [{ variantId, quantity: 1 }],
      expiresAt: new Date(Date.now() - 1000),
    });
    await repo.reservar({
      orderRef: idDeTeste(),
      itens: [{ variantId, quantity: 1 }],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const liberadas = await repo.liberarVencidas(new Date());
    expect(liberadas).toBeGreaterThanOrEqual(1);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.reserved).toBe(1);
    expect(d.disponivel).toBe(2);
  });
});

describe("concorrência", () => {
  /**
   * O teste que dá sentido a todo o desenho de estoque.
   *
   * Duas pessoas tentam levar o último pneu no mesmo instante. Exatamente uma
   * pode ganhar. Se as duas passarem, a loja vendeu o que não tem — a falha
   * mais cara possível numa operação nova.
   */
  it("duas reservas simultâneas do último item: uma passa, a outra falha", async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 1,
      reason: "último da prateleira",
      authorId: "admin",
    });

    const expiresAt = new Date(Date.now() + 60_000);
    const [a, b] = await Promise.all([
      repo.reservar({
        orderRef: idDeTeste(),
        itens: [{ variantId, quantity: 1 }],
        expiresAt,
      }),
      repo.reservar({
        orderRef: idDeTeste(),
        itens: [{ variantId, quantity: 1 }],
        expiresAt,
      }),
    ]);

    expect([a, b].filter((r) => r.ok)).toHaveLength(1);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.reserved).toBe(1);
    expect(d.disponivel).toBe(0);
  });

  it("dez reservas simultâneas com estoque de três: exatamente três passam", async () => {
    await repo.registrarEntrada({
      variantId,
      quantity: 3,
      reason: "estoque inicial",
      authorId: "admin",
    });

    const expiresAt = new Date(Date.now() + 60_000);
    const resultados = await Promise.all(
      Array.from({ length: 10 }, () =>
        repo.reservar({
          orderRef: idDeTeste(),
          itens: [{ variantId, quantity: 1 }],
          expiresAt,
        }),
      ),
    );

    expect(resultados.filter((r) => r.ok)).toHaveLength(3);

    const [d] = await repo.disponibilidadeDe([variantId]);
    expect(d.reserved).toBe(3);
    expect(d.disponivel).toBe(0);
  });
});
