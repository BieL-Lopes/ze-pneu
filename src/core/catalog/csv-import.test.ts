import { describe, it, expect } from "vitest";
import { parseLinhasCatalogo } from "./csv-import";

const CABECALHO =
  "marca,categoria,produto,descricao,sku,ean,preco,medida,tipo_veiculo,peso_gramas,imagem_url";

describe("parseLinhasCatalogo", () => {
  it("lê uma linha válida", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,Primacy 4,Pneu de passeio,MICH-2055516,789123,650.00,205/55 R16 91V,passeio,9000,https://ex.test/a.jpg`;

    const { linhas, erros } = parseLinhasCatalogo(csv);
    expect(erros).toEqual([]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].sku).toBe("MICH-2055516");
    expect(linhas[0].precoCents).toBe(65000);
    expect(linhas[0].medida?.rim).toBe(16);
  });

  it("aceita preço no formato brasileiro", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,Primacy 4,,MICH-1,,"1.250,90",205/55 R16,passeio,9000,`;
    const { linhas, erros } = parseLinhasCatalogo(csv);
    expect(erros).toEqual([]);
    expect(linhas[0].precoCents).toBe(125090);
  });

  it("relata a linha com medida inválida sem abortar as outras", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,Primacy 4,,MICH-1,,650.00,medida-errada,passeio,9000,
Pirelli,Pneus,P7,,PIRE-1,,580.00,205/55 R16,passeio,9000,`;

    const { linhas, erros } = parseLinhasCatalogo(csv);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].sku).toBe("PIRE-1");
    expect(erros).toHaveLength(1);
    expect(erros[0].linha).toBe(2);
    expect(erros[0].motivo).toContain("Medida");
  });

  it("exige os campos obrigatórios", () => {
    const csv = `${CABECALHO}
,Pneus,Primacy 4,,MICH-1,,650.00,205/55 R16,passeio,9000,`;
    const { erros } = parseLinhasCatalogo(csv);
    expect(erros[0].motivo).toContain("marca");
  });

  it("rejeita SKU repetido no mesmo arquivo", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,A,,DUP,,650.00,205/55 R16,passeio,9000,
Michelin,Pneus,B,,DUP,,650.00,195/75 R15,passeio,9000,`;
    const { erros } = parseLinhasCatalogo(csv);
    expect(erros).toHaveLength(1);
    expect(erros[0].motivo).toContain("repetido");
  });

  it("recusa SKU sem peso, porque sem peso não se cotiza frete", () => {
    const csv = `${CABECALHO}
Michelin,Pneus,Primacy 4,,MICH-1,,650.00,205/55 R16,passeio,,`;
    const { linhas, erros } = parseLinhasCatalogo(csv);
    expect(linhas).toHaveLength(0);
    expect(erros[0].motivo).toContain("Peso");
  });

  it("rejeita cabeçalho com coluna faltando", () => {
    const { erros } = parseLinhasCatalogo("marca,produto\nMichelin,A");
    expect(erros[0].motivo).toContain("Coluna");
  });
});
