import { describe, it, expect } from "vitest";
import { linkDeConversa, mensagemDeStatus } from "./aviso-whatsapp";
import type { Pedido } from "./order-repository";

const base = {
  reference: "ZP-ABCD2345",
  comprador: { nome: "Maria da Silva", email: "", telefone: "61999990000", cpf: "" },
  rastreio: null,
} as unknown as Pedido;

describe("mensagemDeStatus", () => {
  it("chama pelo primeiro nome e inclui o link do pedido", () => {
    const m = mensagemDeStatus({ ...base, status: "pronto_para_retirada" }, "https://loja.test/pedido/x");
    expect(m).toMatch(/^Olá, Maria!/);
    expect(m).toContain("pronto para retirada");
    expect(m).toContain("https://loja.test/pedido/x");
  });

  it("enviado leva o rastreio quando há", () => {
    const m = mensagemDeStatus({ ...base, status: "enviado", rastreio: "AA123BR" }, "x");
    expect(m).toContain("AA123BR");
  });
});

describe("linkDeConversa", () => {
  it("põe o DDI do Brasil na frente", () => {
    expect(linkDeConversa("(61) 99999-0000", "oi")).toBe("https://wa.me/5561999990000?text=oi");
  });

  it("telefone inválido não gera link", () => {
    expect(linkDeConversa("123", "oi")).toBeNull();
  });
});
