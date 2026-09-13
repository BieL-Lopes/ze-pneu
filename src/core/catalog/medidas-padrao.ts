/**
 * Medidas de mercado usadas nos seletores da home.
 *
 * A lista é fixa de propósito, e não derivada do catálogo: a pessoa escolhe a
 * medida do pneu que está no carro dela, que pode não estar em estoque hoje.
 * Derivar do estoque esconderia medidas que a loja consegue trazer, e deixaria
 * os seletores vazios sempre que o catálogo estivesse vazio.
 */
export const LARGURAS = [
  145, 155, 165, 175, 185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285,
  295, 305, 315,
] as const;

export const PERFIS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80] as const;

export const AROS = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const;

/** Aros que concentram a maior parte da frota brasileira de passeio. */
export const AROS_POPULARES = [14, 15, 16, 17, 18] as const;
