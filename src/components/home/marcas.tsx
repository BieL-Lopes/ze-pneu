import Link from "next/link";
import type { FacetCount } from "@/core/catalog/types";

/**
 * Marcas que a loja trabalha, cada uma levando à listagem já filtrada.
 *
 * Vem das facetas do próprio catálogo, então a lista nunca promete uma marca
 * que não está à venda. Some quando não há marca nenhuma.
 */
export function Marcas({ marcas }: { marcas: FacetCount[] }) {
  if (marcas.length === 0) return null;

  return (
    <section className="border-t border-neutral-200 py-16">
      <h2 className="text-3xl font-black uppercase italic tracking-tight text-tinta">
        Marcas
      </h2>

      <ul className="mt-8 grid grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-3 lg:grid-cols-6">
        {marcas.map((marca) => (
          <li key={marca.value}>
            <Link
              href={`/pneus?marca=${encodeURIComponent(marca.value)}`}
              className="group flex h-24 flex-col items-center justify-center bg-white px-3 text-center transition hover:bg-tinta"
            >
              <span className="font-black uppercase tracking-tight text-tinta transition group-hover:text-white">
                {marca.label}
              </span>
              <span className="numerais-tabulares mt-1 text-xs text-tinta-media transition group-hover:text-neutral-400">
                {marca.count} {marca.count === 1 ? "medida" : "medidas"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
