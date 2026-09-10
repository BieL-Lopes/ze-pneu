import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // Fronteira de camada: o núcleo é domínio puro. Ele não pode depender da
  // camada web (React/Next) nem da infraestrutura (Drizzle/Postgres). É essa
  // regra que permite o app da Fase 2 reusar o núcleo sem arrastar o site
  // junto. Ver seção 2.1 do design.
  {
    files: ["src/core/**/*.ts", "src/core/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-dom",
                "next",
                "next/*",
                "@/app/*",
                "@/components/*",
                "@/db/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "postgres",
              ],
              message:
                "src/core e dominio puro: nao pode depender da camada web nem da infraestrutura. Veja a secao 2.1 do design.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
