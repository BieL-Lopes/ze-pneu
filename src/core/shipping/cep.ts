/** CEP só com os 8 dígitos, ou null. */
export function normalizarCep(entrada: string): string | null {
  const cep = entrada.replace(/\D/g, "");
  if (cep.length !== 8 || cep === "00000000") return null;
  return cep;
}

export function formatarCep(cep: string): string {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}
