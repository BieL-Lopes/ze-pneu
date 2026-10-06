import type { OpcaoDeFrete } from "./shipping-provider";

/**
 * Regras que a loja aplica sobre a cotação da transportadora.
 *
 * Ficam no painel, não no código: frete grátis é alavanca comercial e muda com
 * campanha; prazo de manuseio muda com a rotina do depósito.
 */
export type RegrasDeFrete = {
  /** Dias úteis entre o pagamento e a postagem, somados ao prazo da transportadora. */
  prazoManuseioDias: number;
  /** A partir deste subtotal, a opção mais barata sai de graça. Null desliga. */
  freteGratisAcimaCents: number | null;
};

export const SEM_REGRAS: RegrasDeFrete = { prazoManuseioDias: 0, freteGratisAcimaCents: null };

/**
 * Só a opção mais barata vira grátis. Zerar todas daria expresso de graça,
 * e a loja pagaria a diferença em todo pedido acima do limite.
 */
export function aplicarRegrasDeFrete(
  opcoes: OpcaoDeFrete[],
  regras: RegrasDeFrete,
  itemsTotalCents: number,
): OpcaoDeFrete[] {
  const comPrazo = opcoes.map((o) => ({
    ...o,
    prazoDias: o.prazoDias + Math.max(0, regras.prazoManuseioDias),
  }));

  const limite = regras.freteGratisAcimaCents;
  if (limite === null || itemsTotalCents < limite || comPrazo.length === 0) return comPrazo;

  const maisBarata = comPrazo.reduce((a, b) => (b.precoCents < a.precoCents ? b : a));
  return comPrazo
    .map((o) => (o.id === maisBarata.id ? { ...o, precoCents: 0 } : o))
    .sort((a, b) => a.precoCents - b.precoCents);
}

/** Lê as regras das configurações em texto, ignorando valor malformado. */
export function regrasDasConfiguracoes(config: Record<string, string | null>): RegrasDeFrete {
  const dias = Number(config.frete_prazo_manuseio_dias);
  const limite = Number(config.frete_gratis_acima_centavos);
  return {
    prazoManuseioDias: Number.isInteger(dias) && dias > 0 ? dias : 0,
    freteGratisAcimaCents:
      config.frete_gratis_acima_centavos && Number.isInteger(limite) && limite > 0 ? limite : null,
  };
}

export const CHAVES_DE_FRETE = ["frete_prazo_manuseio_dias", "frete_gratis_acima_centavos"];
