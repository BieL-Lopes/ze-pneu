import { describe, it, expect } from "vitest";
import { aplicarRegrasDeFrete, regrasDasConfiguracoes, SEM_REGRAS } from "./regras-de-frete";

const pac = { id: "1", servico: "PAC", transportadora: "Correios", prazoDias: 5, precoCents: 8990 };
const sedex = { id: "2", servico: "SEDEX", transportadora: "Correios", prazoDias: 2, precoCents: 15990 };
const jadlog = { id: "3", servico: ".Package", transportadora: "Jadlog", prazoDias: 4, precoCents: 7990 };

describe("aplicarRegrasDeFrete", () => {
  it("sem regras devolve a cotação como veio", () => {
    expect(aplicarRegrasDeFrete([pac, sedex], SEM_REGRAS, 100_000)).toEqual([pac, sedex]);
  });

  it("soma o prazo de manuseio a todas as opções", () => {
    const r = aplicarRegrasDeFrete([pac, sedex], { prazoManuseioDias: 2, freteGratisAcimaCents: null }, 0);
    expect(r.map((o) => o.prazoDias)).toEqual([7, 4]);
  });

  it("acima do limite, só a opção mais barata sai de graça e vai para o topo", () => {
    const r = aplicarRegrasDeFrete(
      [sedex, pac, jadlog],
      { prazoManuseioDias: 0, freteGratisAcimaCents: 100_000 },
      120_000,
    );
    expect(r[0]).toEqual({ ...jadlog, precoCents: 0 });
    expect(r.find((o) => o.id === "1")!.precoCents).toBe(8990);
    expect(r.find((o) => o.id === "2")!.precoCents).toBe(15990);
  });

  it("abaixo do limite, nada é grátis", () => {
    const r = aplicarRegrasDeFrete([pac], { prazoManuseioDias: 0, freteGratisAcimaCents: 100_000 }, 99_999);
    expect(r[0].precoCents).toBe(8990);
  });
});

describe("regrasDasConfiguracoes", () => {
  it("lê os valores gravados", () => {
    expect(
      regrasDasConfiguracoes({ frete_prazo_manuseio_dias: "2", frete_gratis_acima_centavos: "150000" }),
    ).toEqual({ prazoManuseioDias: 2, freteGratisAcimaCents: 150000 });
  });

  it("valor ausente ou malformado desliga a regra", () => {
    expect(regrasDasConfiguracoes({ frete_prazo_manuseio_dias: "abc" })).toEqual(SEM_REGRAS);
    expect(regrasDasConfiguracoes({ frete_gratis_acima_centavos: "0" })).toEqual(SEM_REGRAS);
  });
});
