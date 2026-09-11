const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Preços são guardados em centavos (inteiro) para não sofrer erro de ponto flutuante. */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}
