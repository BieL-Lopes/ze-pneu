import { readFileSync } from "node:fs";
import { db } from "@/db/client";
import { importarCatalogo } from "@/db/importar-catalogo";

async function main() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error("Uso: npm run import:catalogo -- caminho/do/arquivo.csv");
    process.exit(1);
  }

  const { variantes, erros } = await importarCatalogo(db, readFileSync(caminho, "utf8"));

  for (const erro of erros) {
    console.error(`Linha ${erro.linha}: ${erro.motivo}`);
  }

  if (variantes === 0) {
    console.error("Nenhuma linha válida. Nada foi importado.");
    process.exit(1);
  }

  console.log(
    `Importadas ${variantes} variantes. ${erros.length} linhas com erro.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
