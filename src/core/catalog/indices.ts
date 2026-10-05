/**
 * Índice de carga → kg por pneu, tabela padrão ETRTO/ISO 4223 (50 a 130).
 *
 * O número da lateral não diz nada ao cliente; "até 615 kg por pneu" diz.
 */
const CARGA_KG = [
  190, 195, 200, 206, 212, 218, 224, 230, 236, 243, // 50–59
  250, 257, 265, 272, 280, 290, 300, 307, 315, 325, // 60–69
  335, 345, 355, 365, 375, 387, 400, 412, 425, 437, // 70–79
  450, 462, 475, 487, 500, 515, 530, 545, 560, 580, // 80–89
  600, 615, 630, 650, 670, 690, 710, 730, 750, 775, // 90–99
  800, 825, 850, 875, 900, 925, 950, 975, 1000, 1030, // 100–109
  1060, 1090, 1120, 1150, 1180, 1215, 1250, 1285, 1320, 1360, // 110–119
  1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850, // 120–129
  1900, // 130
];
const PRIMEIRO_INDICE = 50;

export function cargaMaximaKg(indice: number): number | null {
  return CARGA_KG[indice - PRIMEIRO_INDICE] ?? null;
}

/** Símbolo de velocidade → velocidade máxima em km/h. */
const VELOCIDADE_KMH: Record<string, number> = {
  L: 120,
  M: 130,
  N: 140,
  P: 150,
  Q: 160,
  R: 170,
  S: 180,
  T: 190,
  U: 200,
  H: 210,
  V: 240,
  W: 270,
  Y: 300,
};

export function velocidadeMaximaKmh(simbolo: string): number | null {
  return VELOCIDADE_KMH[simbolo.toUpperCase()] ?? null;
}
