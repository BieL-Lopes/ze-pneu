import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { testDb, schemaEmUso } from "../helpers/db";

/**
 * Guarda de segurança da suíte inteira.
 *
 * Os testes truncam tabelas. Rodar com a conexão apontada para "public"
 * apagaria o catálogo e os pedidos reais, porque a mesma instância Postgres
 * serve produção e teste. Este arquivo falha antes que isso aconteça.
 */
describe("isolamento do schema de teste", () => {
  it("não está escrevendo em public", async () => {
    const atual = await schemaEmUso();
    expect(
      atual,
      `Os testes estão apontados para o schema "${atual}". Truncar ali apagaria dados reais.`,
    ).not.toBe("public");
  });

  it("escreve no schema dedicado", async () => {
    expect(await schemaEmUso()).toBe(process.env.TEST_SCHEMA ?? "teste");
  });

  it("as tabelas usadas pelos testes vivem nesse schema", async () => {
    const atual = await schemaEmUso();
    const linhas = await testDb.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables
          WHERE table_schema = ${atual} AND table_name = 'products'`,
    );
    expect((linhas as unknown as { table_name: string }[]).length).toBe(1);
  });
});
