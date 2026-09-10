"use client";

import { useState } from "react";

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
        className="mb-4 flex w-full items-center justify-between rounded-lg border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-900 lg:hidden"
      >
        <span>
          Filtrar
          {filtrosAtivos > 0 && (
            <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
              {filtrosAtivos}
            </span>
          )}
        </span>
        <span aria-hidden="true">{aberto ? "▲" : "▼"}</span>
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
