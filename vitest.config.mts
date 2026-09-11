import { defineConfig } from "vitest/config";

// Os testes de integração precisam de DATABASE_URL_TEST. O Vitest roda fora do
// Next, então não herda o carregamento de .env.local que o framework faz.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local: as variáveis vêm do ambiente (CI).
}

// Qualquer código que abra conexão por DATABASE_URL (o cliente usado pelas
// rotas, por exemplo) precisa cair no banco de teste. Sem isto, um teste
// semearia o banco de teste e consultaria o de desenvolvimento — e, pior,
// truncaria dados reais se a suíte rodasse com o .env.local de produção.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
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
