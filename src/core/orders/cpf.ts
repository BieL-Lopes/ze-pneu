function digitoVerificador(digitos: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    soma += Number(digitos[i]) * (pesoInicial - i);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/**
 * Devolve o CPF só com dígitos, ou null se for inválido.
 *
 * Validar os dígitos verificadores aqui evita que um CPF digitado errado chegue
 * ao Mercado Pago e à nota fiscal — ali o erro aparece tarde e longe do cliente.
 */
export function normalizarCpf(entrada: string): string | null {
  const cpf = entrada.replace(/\D/g, "");
  if (cpf.length !== 11) return null;
  // Sequências repetidas passam no cálculo, mas não são CPFs emitidos.
  if (/^(\d)\1{10}$/.test(cpf)) return null;

  if (digitoVerificador(cpf.slice(0, 9), 10) !== Number(cpf[9])) return null;
  if (digitoVerificador(cpf.slice(0, 10), 11) !== Number(cpf[10])) return null;
  return cpf;
}
