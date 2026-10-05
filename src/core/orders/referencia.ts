// Sem 0/O, 1/I/L: o cliente dita a referência pelo WhatsApp, e letra que se
// confunde com número vira pedido não encontrado.
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Referência curta do pedido, como "ZP-7KQ2M9XA".
 *
 * 31^8 combinações (~850 bilhões): colisão é improvável, e o índice único do
 * banco recusa a que acontecer.
 */
export function gerarReferencia(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let ref = "";
  for (const b of bytes) ref += ALFABETO[b % ALFABETO.length];
  return `ZP-${ref}`;
}

/** 256 bits aleatórios em base64url: o segredo do link de acompanhamento. */
export function gerarTokenDeAcesso(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}
