import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stockLocations, productVariants } from "@/db/schema";
import { createDrizzleStockRepository } from "@/db/repositories/drizzle-stock-repository";

/**
 * Lança uma quantidade inicial em todos os SKUs.
 *
 * Serve para colocar a loja em pé depois de importar um catálogo novo. Cada
 * lançamento é uma entrada no livro-razão, com motivo, então o extrato do SKU
 * mostra de onde o saldo veio.
 */
async function main() {
  const quantidade = Number(process.argv[2] ?? 10);
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    console.error("Uso: npm run seed:estoque -- <quantidade>");
    process.exit(1);
  }

  const [local] = await db
    .select()
    .from(stockLocations)
    .where(eq(stockLocations.slug, "brasilia"))
    .limit(1);

  if (!local) {
    console.error(
      'Local de estoque "brasilia" não existe. A migração de estoque não foi aplicada.',
    );
    process.exit(1);
  }

  const estoque = createDrizzleStockRepository(db, local.id);
  const variantes = await db
    .select({ id: productVariants.id, sku: productVariants.sku })
    .from(productVariants);

  if (variantes.length === 0) {
    console.error("Nenhum SKU cadastrado. Importe o catálogo primeiro.");
    process.exit(1);
  }

  for (const v of variantes) {
    await estoque.registrarEntrada({
      variantId: v.id,
      quantity: quantidade,
      reason: "Carga inicial de estoque",
      authorId: "seed",
    });
  }

  console.log(
    `Entrada de ${quantidade} unidades lançada em ${variantes.length} SKUs.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
