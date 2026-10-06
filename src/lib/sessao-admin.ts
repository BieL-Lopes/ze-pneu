import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminSessions, adminUsers } from "@/db/schema";
import { conferirSenha, gerarHashDeSenha } from "@/core/admin/senha";
import { podeAcessar, type Area, type Papel } from "@/core/admin/papeis";

const COOKIE = "ze_painel";
const DURACAO_MS = 12 * 60 * 60 * 1000;
const TENTATIVAS_ANTES_DE_TRAVAR = 5;
const TRAVA_MS = 15 * 60 * 1000;

export type UsuarioDoPainel = {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
};

function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Hash de uma senha qualquer, calculado uma vez. Conferir contra ele quando o
// e-mail não existe faz a resposta levar o mesmo tempo nos dois casos: pelo
// relógio não dá para descobrir quais e-mails têm acesso ao painel.
let hashFalso: Promise<string> | null = null;

export async function entrar(
  emailDigitado: string,
  senha: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const email = emailDigitado.trim().toLowerCase();
  const recusa = { ok: false as const, erro: "E-mail ou senha incorretos." };

  const [usuario] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);

  if (!usuario || !usuario.active) {
    hashFalso ??= gerarHashDeSenha(randomBytes(16).toString("hex"));
    await conferirSenha(senha, await hashFalso);
    return recusa;
  }

  const agora = new Date();
  if (usuario.lockedUntil && usuario.lockedUntil > agora) {
    return { ok: false, erro: "Acesso travado por excesso de tentativas. Tente de novo em 15 minutos." };
  }

  if (!(await conferirSenha(senha, usuario.passwordHash))) {
    const tentativas = usuario.failedAttempts + 1;
    const travar = tentativas >= TENTATIVAS_ANTES_DE_TRAVAR;
    await db
      .update(adminUsers)
      .set({
        failedAttempts: travar ? 0 : tentativas,
        lockedUntil: travar ? new Date(agora.getTime() + TRAVA_MS) : null,
      })
      .where(eq(adminUsers.id, usuario.id));
    return recusa;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(agora.getTime() + DURACAO_MS);

  await db.transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: agora })
      .where(eq(adminUsers.id, usuario.id));
    // Faxina: sessões vencidas deste usuário não servem para nada.
    await tx
      .delete(adminSessions)
      .where(and(eq(adminSessions.userId, usuario.id), lt(adminSessions.expiresAt, agora)));
    await tx.insert(adminSessions).values({ userId: usuario.id, tokenHash: hashDoToken(token), expiresAt });
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  return { ok: true };
}

export async function sair() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hashDoToken(token)));
  jar.delete(COOKIE);
}

/** Encerra todas as sessões de um usuário — ao trocar a senha ou desativar. */
export async function encerrarSessoesDe(userId: string, excetoAtual = false) {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const atual = excetoAtual && token ? hashDoToken(token) : null;
  await db
    .delete(adminSessions)
    .where(
      atual
        ? and(eq(adminSessions.userId, userId), sql`${adminSessions.tokenHash} <> ${atual}`)
        : eq(adminSessions.userId, userId),
    );
}

/**
 * Usuário logado, ou null.
 *
 * Memorizado por requisição: o layout, a página e a ação perguntam a mesma
 * coisa e o banco responde uma vez.
 */
export const usuarioAtual = cache(async (): Promise<UsuarioDoPainel | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const [linha] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      nome: adminUsers.name,
      papel: adminUsers.role,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.userId))
    .where(
      and(
        eq(adminSessions.tokenHash, hashDoToken(token)),
        gt(adminSessions.expiresAt, new Date()),
        eq(adminUsers.active, true),
      ),
    )
    .limit(1);

  return linha ?? null;
});

/**
 * Porta de entrada de toda página e ação do painel.
 *
 * Chamada em cada uma, não só no layout: o layout não roda de novo na
 * navegação entre páginas, e uma Server Action pode ser chamada direto, sem
 * passar por página nenhuma.
 */
export async function exigirUsuario(area?: Area): Promise<UsuarioDoPainel> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/admin/entrar");
  if (area && !podeAcessar(usuario.papel, area)) redirect("/admin?sem-permissao=1");
  return usuario;
}
