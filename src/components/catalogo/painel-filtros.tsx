"use client";

import { useState } from "react";
import { IconeChevron } from "@/components/icones";

/**
 * Envolve as facetas para que, no celular, elas não empurrem os produtos para
 * fora da tela.
 *
 * Com cinco grupos de faceta abertos, um cliente no telefone rolaria dezenas
 * de linhas de filtro antes de ver o primeiro pneu. Como a maior parte do
 * tráfego é mobile, isso custa venda.
 *
 * As facetas em si continuam sendo renderizadas no servidor: este componente
 * só recebe `children` e controla a visibilidade.
 */
export function PainelFiltros({
  children,
  filtrosAtivos,
}: {
  children: React.ReactNode;
  filtrosAtivos: number;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls="painel-filtros"
        className="mb-4 flex w-full items-center justify-between border border-tinta px-4 py-3 text-sm font-bold uppercase tracking-wide text-tinta transition hover:bg-neutral-100 lg:hidden"
      >
        <span className="flex items-center gap-2">
          Filtrar
          {filtrosAtivos > 0 && (
            <span className="numerais-tabulares inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-marca px-1.5 text-xs font-bold text-white">
              {filtrosAtivos}
            </span>
          )}
        </span>
        <IconeChevron
          className={`h-4 w-4 transition-transform duration-200 ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id="painel-filtros"
        className={`${aberto ? "block" : "hidden"} lg:block`}
      >
        {children}
      </div>
    </div>
  );
}
