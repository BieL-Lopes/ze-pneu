import type { TireSize } from "./tire-size";

export type DimensoesDaCaixa = {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
};

/** Folga do embrulho em cada dimensão. */
const FOLGA_MM = 20;

/**
 * Caixa que envolve um pneu deitado: lado = diâmetro externo, altura = largura.
 *
 * A transportadora cobra pelo maior entre peso real e peso cubado, e no pneu o
 * cubado costuma ganhar. Uma caixa única para todo pneu fazia o aro 13 e o
 * aro 24 custarem o mesmo frete.
 */
export function dimensoesDaCaixa(
  medida: Pick<TireSize, "width" | "profile" | "rim">,
): DimensoesDaCaixa {
  const diametro =
    medida.rim * 25.4 + (2 * medida.width * medida.profile) / 100;
  const lado = Math.round(diametro) + FOLGA_MM;
  return {
    lengthMm: lado,
    widthMm: lado,
    heightMm: medida.width + FOLGA_MM,
  };
}
