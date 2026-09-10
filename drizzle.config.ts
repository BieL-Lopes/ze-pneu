import { defineConfig } from "drizzle-kit";

// O drizzle-kit roda fora do Next, então não herda o carregamento de .env.local
// que o framework faz. No CI as variáveis já vêm do ambiente e o arquivo não
// existe — daí o try/catch em vez de uma checagem de existência.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local: as variáveis vêm do ambiente (CI, produção).
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não configurada");

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
