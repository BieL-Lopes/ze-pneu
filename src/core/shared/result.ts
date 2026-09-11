/**
 * Resultado de uma operação que pode falhar de forma esperada.
 *
 * O domínio devolve `Result` para falha prevista — medida inválida, estoque
 * insuficiente, CEP não atendido. Exceção fica reservada para o que é
 * genuinamente inesperado, e por isso merece parar o fluxo e ir para o Sentry.
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
