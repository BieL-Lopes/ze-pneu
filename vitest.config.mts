import { defineConfig } from "vitest/config";

// Os testes de integração precisam de DATABASE_URL. O Vitest roda fora do
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
    // Arquivos rodam em paralelo: cada teste cria registros com prefixo próprio
    // e remove apenas os seus, então dois arquivos não se atrapalham. O banco
    // é remoto e a latência domina o tempo — serializar custaria minutos.
    fileParallelism: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
