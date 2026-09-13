import { describe, it, expect } from "vitest";
import {
  podeTransicionar,
  transicionar,
  transicoesValidas,
  eFinal,
  ROTULO_STATUS,
  type OrderStatus,
} from "./order-status";

describe("podeTransicionar", () => {
  it("permite o caminho feliz de entrega", () => {
    expect(podeTransicionar("aguardando_pagamento", "pago")).toBe(true);
    expect(podeTransicionar("pago", "em_separacao")).toBe(true);
    expect(podeTransicionar("em_separacao", "enviado")).toBe(true);
    expect(podeTransicionar("enviado", "entregue")).toBe(true);
  });

  it("permite o caminho de retirada", () => {
    expect(podeTransicionar("em_separacao", "pronto_para_retirada")).toBe(true);
    expect(podeTransicionar("pronto_para_retirada", "retirado")).toBe(true);
  });

  it("permite cancelar enquanto não foi pago", () => {
    expect(podeTransicionar("aguardando_pagamento", "cancelado")).toBe(true);
  });

  it("permite estornar depois de pago", () => {
    expect(podeTransicionar("pago", "estornado")).toBe(true);
  });

  it("proíbe pular o pagamento", () => {
    expect(podeTransicionar("aguardando_pagamento", "enviado")).toBe(false);
    expect(podeTransicionar("aguardando_pagamento", "entregue")).toBe(false);
  });

  it("proíbe ressuscitar pedido cancelado", () => {
    expect(podeTransicionar("cancelado", "pago")).toBe(false);
    expect(podeTransicionar("cancelado", "aguardando_pagamento")).toBe(false);
  });

  it("proíbe voltar atrás", () => {
    expect(podeTransicionar("entregue", "enviado")).toBe(false);
    expect(podeTransicionar("pago", "aguardando_pagamento")).toBe(false);
  });

  it("proíbe misturar entrega com retirada", () => {
    expect(podeTransicionar("enviado", "retirado")).toBe(false);
    expect(podeTransicionar("pronto_para_retirada", "entregue")).toBe(false);
  });
});

describe("transicionar", () => {
  it("devolve o novo status quando a transição é válida", () => {
    const r = transicionar("aguardando_pagamento", "pago");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("pago");
  });

  it("explica o motivo quando é inválida", () => {
    const r = transicionar("cancelado", "pago");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Cancelado");
      expect(r.error).toContain("Pago");
    }
  });
});

describe("eFinal", () => {
  it("reconhece os estados de onde não se sai", () => {
    for (const s of [
      "entregue",
      "retirado",
      "cancelado",
      "estornado",
    ] as const) {
      expect(eFinal(s), s).toBe(true);
    }
  });

  it("não marca estados intermediários como finais", () => {
    for (const s of ["aguardando_pagamento", "pago", "em_separacao"] as const) {
      expect(eFinal(s), s).toBe(false);
    }
  });
});

describe("rótulos", () => {
  it("tem rótulo em português para todo status", () => {
    for (const status of Object.keys(transicoesValidas) as OrderStatus[]) {
      expect(ROTULO_STATUS[status], status).toBeTruthy();
    }
  });
});
