import { defineConfig } from "vitest/config";

// Os testes de integração precisam de DATABASE_URL_TEST. O Vitest roda fora do
// Next, então não herda o carregamento de .env.local que o framework faz.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local: as variáveis vêm do ambiente (CI).
}

export default defineConfig({
  // Vite 8 resolve os paths do tsconfig nativamente ("@/*" -> "src/*"),
  // então o plugin vite-tsconfig-paths não é mais necessário.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Os testes de integração truncam tabelas do mesmo banco. Rodar arquivos
    // em paralelo faria um teste apagar as linhas do outro no meio da execução.
    fileParallelism: false,
  },
});
