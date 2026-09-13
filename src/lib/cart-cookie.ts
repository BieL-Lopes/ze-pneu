import { cookies } from "next/headers";

const NOME = "ze_carrinho";
const UM_ANO = 60 * 60 * 24 * 365;

/**
 * Token do carrinho de visitante.
 *
 * Comprar sem cadastro é exigência do design: pedir conta antes da compra
 * derruba conversão. O cookie é httpOnly para que script de terceiro não
 * consiga ler nem trocar o carrinho de alguém.
 */
export async function tokenDoCarrinho(): Promise<string> {
  const jar = await cookies();
  const atual = jar.get(NOME)?.value;
  if (atual) return atual;

  const novo = crypto.randomUUID();
  jar.set(NOME, novo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UM_ANO,
    path: "/",
  });
  return novo;
}
