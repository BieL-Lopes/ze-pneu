import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { adminSessions, adminUsers } from "@/db/schema";
import { conferirSenha, gerarHashDeSenha } from "@/core/admin/senha";
import type { Papel } from "@/core/admin/papeis";
import { type Result, ok, err } from "@/core/shared/result";

export async function criarUsuario(dados: {
  email: string;
  nome: string;
  papel: Papel;
  senha: string;
}): Promise<Result<void>> {
  const email = dados.email.trim().toLowerCase();
  const [existente] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (existente) return err("Já existe um usuário com este e-mail.");

  await db.insert(adminUsers).values({
    email,
    name: dados.nome.trim(),
    role: dados.papel,
    passwordHash: await gerarHashDeSenha(dados.senha),
  });
  return ok(undefined);
}

/** Troca a senha e derruba as sessões abertas: quem tinha a senha antiga sai. */
export async function definirSenha(userId: string, senha: string): Promise<void> {
  const hash = await gerarHashDeSenha(senha);
  await db.transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ passwordHash: hash, failedAttempts: 0, lockedUntil: null })
      .where(eq(adminUsers.id, userId));
    await tx.delete(adminSessions).where(eq(adminSessions.userId, userId));
  });
}

export async function senhaConfere(userId: string, senha: string): Promise<boolean> {
  const [u] = await db.select({ hash: adminUsers.passwordHash }).from(adminUsers).where(eq(adminUsers.id, userId)).limit(1);
  return u ? conferirSenha(senha, u.hash) : false;
}

export async function alterarUsuario(userId: string, dados: { papel?: Papel; ativo?: boolean }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ role: dados.papel, active: dados.ativo })
      .where(eq(adminUsers.id, userId));
    if (dados.ativo === false) await tx.delete(adminSessions).where(eq(adminSessions.userId, userId));
  });
}
