import { defineConfig } from "drizzle-kit";

// Config separado para o banco de teste. Um arquivo explícito em vez de
// sobrescrever DATABASE_URL na linha de comando: no Windows o npm roda scripts
// pelo cmd.exe, onde o prefixo `VAR=valor comando` não existe.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local: as variáveis vêm do ambiente (CI).
}

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST não configurada");

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
