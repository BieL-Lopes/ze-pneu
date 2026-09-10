import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 resolve os paths do tsconfig nativamente ("@/*" -> "src/*"),
  // entao o plugin vite-tsconfig-paths nao e mais necessario.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
