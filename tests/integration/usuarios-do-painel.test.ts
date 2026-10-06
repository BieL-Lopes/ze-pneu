import { describe, it, expect, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { testDb, limparDadosDeTeste, idDeTeste } from "../helpers/db";
import * as schema from "@/db/schema";

// O módulo usa o cliente da aplicação; nos testes, o mesmo banco da suíte.
vi.mock("@/db/client", () => ({ db: testDb }));

const { criarUsuario, definirSenha, senhaConfere, alterarUsuario } = await import("@/db/usuarios-do-painel");

afterAll(limparDadosDeTeste);

async function idDe(email: string) {
  const [u] = await testDb.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email));
  return u;
}

describe("usuários do painel", () => {
  it("cria com senha em hash, recusa e-mail repetido e normaliza caixa", async () => {
    const email = `${idDeTeste()}@zepneu.test`;
    expect((await criarUsuario({ email: email.toUpperCase(), nome: "Ana", papel: "operador", senha: "senha-bem-comprida" })).ok).toBe(true);
    expect((await criarUsuario({ email, nome: "Ana 2", papel: "admin", senha: "outra-senha-longa" })).ok).toBe(false);

    const u = await idDe(email);
    expect(u.passwordHash).not.toContain("senha-bem-comprida");
    expect(await senhaConfere(u.id, "senha-bem-comprida")).toBe(true);
  });

  it("trocar a senha e desativar encerram as sessões abertas", async () => {
    const email = `${idDeTeste()}@zepneu.test`;
    await criarUsuario({ email, nome: "Beto", papel: "operador", senha: "senha-bem-comprida" });
    const u = await idDe(email);
    const sessao = () =>
      testDb.insert(schema.adminSessions).values({ userId: u.id, tokenHash: idDeTeste(), expiresAt: new Date(Date.now() + 60_000) });
    const abertas = async () =>
      (await testDb.select().from(schema.adminSessions).where(eq(schema.adminSessions.userId, u.id))).length;

    await sessao();
    await definirSenha(u.id, "nova-senha-comprida");
    expect(await abertas()).toBe(0);
    expect(await senhaConfere(u.id, "nova-senha-comprida")).toBe(true);

    await sessao();
    await alterarUsuario(u.id, { ativo: false });
    expect(await abertas()).toBe(0);
  });
});
