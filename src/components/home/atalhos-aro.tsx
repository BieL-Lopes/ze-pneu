import Link from "next/link";
import { AROS_POPULARES } from "@/core/catalog/medidas-padrao";
import { BotaoLink } from "@/components/ui/botao";

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
        <BotaoLink
          key={aro}
          href={`/pneus?aro=${aro}`}
          variante="sutil"
          tamanho="pequeno"
          className="numerais-tabulares hover:border-marca hover:bg-marca hover:text-white"
        >
          Aro {aro}
        </BotaoLink>
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
