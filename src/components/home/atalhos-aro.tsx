import Link from "next/link";
import { AROS_POPULARES } from "@/core/catalog/medidas-padrao";

/**
 * Atalhos por aro.
 *
 * Cada um é uma URL real e indexável — "/pneus?aro=16" é exatamente a página
 * que alguém procurando "pneu aro 16" deveria encontrar no Google.
 */
export function AtalhosAro() {
  return (
    <nav aria-label="Buscar por aro" className="flex flex-wrap gap-3">
      {AROS_POPULARES.map((aro) => (
        <Link
          key={aro}
          href={`/pneus?aro=${aro}`}
          className="numerais-tabulares border border-neutral-300 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-tinta transition hover:border-marca hover:bg-marca hover:text-white"
        >
          Aro {aro}
        </Link>
      ))}
      <Link
        href="/pneus"
        className="px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-marca transition hover:text-marca-escura"
      >
        Ver todas as medidas
      </Link>
    </nav>
  );
}
