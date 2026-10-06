import { describe, it, expect } from "vitest";
import { validarProduto, validarUrlDeFoto, validarVariante } from "./cadastro";

const variante = {
  sku: "apt-ra301-2055516",
  ean: "",
  preco: "324,38",
  medida: "205/55 R16 91V",
  tipoVeiculo: "passeio",
  pesoKg: "8,8",
};

describe("validarVariante", () => {
  it("normaliza SKU, preço, medida e peso", () => {
    const r = validarVariante(variante);
    expect(r).toEqual({
      ok: true,
      value: {
        sku: "APT-RA301-2055516",
        ean: null,
        precoCents: 32438,
        medida: { width: 205, profile: 55, rim: 16, loadIndex: 91, speedRating: "V" },
        tipoVeiculo: "passeio",
        pesoGramas: 8800,
      },
    });
  });

  it("acessório não tem medida", () => {
    const r = validarVariante({ ...variante, medida: "", tipoVeiculo: "" });
    expect(r.ok && r.value.medida).toBeNull();
  });

  it("recusa peso ausente: sem ele não há frete", () => {
    expect(validarVariante({ ...variante, pesoKg: "" }).ok).toBe(false);
  });

  it("recusa medida que não é de pneu", () => {
    expect(validarVariante({ ...variante, medida: "abc" }).ok).toBe(false);
  });

  it("recusa SKU com espaço ou símbolo", () => {
    expect(validarVariante({ ...variante, sku: "RA 301" }).ok).toBe(false);
  });
});

describe("validarProduto", () => {
  it("exige nome, marca e categoria", () => {
    expect(validarProduto({ nome: "", descricao: "", status: "active", marca: "Aptany", categoria: "Pneus" }).ok).toBe(false);
    expect(validarProduto({ nome: "RA301", descricao: "", status: "active", marca: "", categoria: "Pneus" }).ok).toBe(false);
  });

  it("descrição vazia vira null", () => {
    const r = validarProduto({ nome: "RA301", descricao: "  ", status: "draft", marca: "Aptany", categoria: "Pneus" });
    expect(r.ok && r.value.descricao).toBeNull();
  });

  it("recusa status desconhecido", () => {
    expect(validarProduto({ nome: "RA301", descricao: "", status: "x", marca: "A", categoria: "P" }).ok).toBe(false);
  });
});

describe("validarUrlDeFoto", () => {
  it("só aceita https", () => {
    expect(validarUrlDeFoto("https://cdn.test/a.jpg").ok).toBe(true);
    expect(validarUrlDeFoto("http://cdn.test/a.jpg").ok).toBe(false);
    expect(validarUrlDeFoto("javascript:alert(1)").ok).toBe(false);
  });
});
