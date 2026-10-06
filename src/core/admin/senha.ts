import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Hash de senha do painel.
 *
 * scrypt vem no Node: nenhuma dependência nativa (bcrypt, argon2) para
 * compilar na Vercel. O formato guarda os parâmetros junto do hash, então
 * endurecer o custo depois não invalida as senhas já gravadas.
 */
const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 64;

function derivar(senha: string, sal: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, sal, TAMANHO, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    );
  });
}

export async function gerarHashDeSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await derivar(senha, sal, N, R, P);
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64url")}$${chave.toString("base64url")}`;
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  const partes = hash.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, esperado] = partes;

  const alvo = Buffer.from(esperado, "base64url");
  const chave = await derivar(senha, Buffer.from(sal, "base64url"), Number(n), Number(r), Number(p));
  return chave.length === alvo.length && timingSafeEqual(chave, alvo);
}

/** Regra mínima: 10 caracteres. Comprimento protege mais que símbolo obrigatório. */
export function problemaNaSenha(senha: string): string | null {
  if (senha.length < 10) return "A senha precisa de pelo menos 10 caracteres.";
  if (senha.length > 200) return "Senha longa demais.";
  return null;
}

/** Senha provisória legível, para o primeiro acesso. */
export function gerarSenhaProvisoria(): string {
  return randomBytes(12).toString("base64url");
}
