import { describe, it, expect, vi } from "vitest";
import { createOperacoesDeEstoque } from "./operacoes-de-estoque";

function montar(onHand: number, reserved: number) {
  const estoque = {
    disponibilidadeDe: vi.fn(async (ids: string[]) =>
      ids.map((variantId) => ({ variantId, onHand, reserved, disponivel: onHand - reserved })),
    ),
    registrarEntrada: vi.fn(async () => {}),
    ajustar: vi.fn(async () => {}),
  };
  return { ops: createOperacoesDeEstoque({ estoque }), estoque };
}

describe("darEntrada", () => {
  it("lança com motivo e autor", async () => {
    const { ops, estoque } = montar(0, 0);
    const r = await ops.darEntrada({ variantId: "v1", quantidade: 8, motivo: " NF 123 ", autor: "ana" });
    expect(r.ok).toBe(true);
    expect(estoque.registrarEntrada).toHaveBeenCalledWith({ variantId: "v1", quantity: 8, reason: "NF 123", authorId: "ana" });
  });

  it("recusa quantidade zero, fracionada ou sem motivo", async () => {
    const { ops, estoque } = montar(0, 0);
    expect((await ops.darEntrada({ variantId: "v1", quantidade: 0, motivo: "NF 1", autor: "a" })).ok).toBe(false);
    expect((await ops.darEntrada({ variantId: "v1", quantidade: 1.5, motivo: "NF 1", autor: "a" })).ok).toBe(false);
    expect((await ops.darEntrada({ variantId: "v1", quantidade: 4, motivo: " ", autor: "a" })).ok).toBe(false);
    expect(estoque.registrarEntrada).not.toHaveBeenCalled();
  });
});

describe("ajustar", () => {
  it("exige motivo", async () => {
    const { ops } = montar(10, 0);
    expect((await ops.ajustar({ variantId: "v1", delta: -2, motivo: "", autor: "a" })).ok).toBe(false);
  });

  it("não deixa o físico ficar abaixo do reservado", async () => {
    const { ops, estoque } = montar(5, 4);
    const r = await ops.ajustar({ variantId: "v1", delta: -2, motivo: "avaria", autor: "a" });
    expect(r.ok).toBe(false);
    expect(estoque.ajustar).not.toHaveBeenCalled();
  });

  it("ajuste válido grava delta, motivo e autor", async () => {
    const { ops, estoque } = montar(5, 1);
    const r = await ops.ajustar({ variantId: "v1", delta: -4, motivo: "contagem de inventário", autor: "a" });
    expect(r.ok).toBe(true);
    expect(estoque.ajustar).toHaveBeenCalledWith({ variantId: "v1", delta: -4, reason: "contagem de inventário", authorId: "a" });
  });
});
