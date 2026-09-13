"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { definirItemDoCarrinho } from "@/app/(loja)/carrinho/acoes";
import { IconeCarrinho } from "@/components/icones-carrinho";
import { LIMITE_POR_ITEM } from "@/core/cart/cart-totals";

export function BotaoAdicionar({
  variantId,
  disponivel,
}: {
  variantId: string;
  disponivel: number;
}) {
  const [quantidade, setQuantidade] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  if (disponivel <= 0) {
    return (
      <p className="mt-8 border border-neutral-300 px-6 py-4 text-center text-sm font-bold uppercase tracking-wide text-tinta-media">
        Esgotado nesta medida
      </p>
    );
  }

  function adicionar() {
    setErro(null);
    iniciar(async () => {
      const dados = new FormData();
      dados.set("variantId", variantId);
      dados.set("quantity", String(quantidade));

      const r = await definirItemDoCarrinho(dados);
      if (!r.ok) setErro(r.erro);
      else router.push("/carrinho");
    });
  }

  const maximo = Math.min(disponivel, LIMITE_POR_ITEM);

  return (
    <div className="mt-8">
      <div className="flex gap-3">
        <label className="sr-only" htmlFor="quantidade">
          Quantidade
        </label>
        <select
          id="quantidade"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          className="numerais-tabulares border border-neutral-300 px-4 py-4 font-bold text-tinta"
        >
          {Array.from({ length: maximo }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={adicionar}
          disabled={pendente}
          className="flex flex-1 items-center justify-center gap-2 bg-marca px-6 py-4 text-base font-bold uppercase tracking-wide text-white transition hover:bg-marca-escura disabled:opacity-60"
        >
          <IconeCarrinho className="h-5 w-5" />
          {pendente ? "Adicionando..." : "Adicionar ao carrinho"}
        </button>
      </div>

      {/* Escassez real, lida do estoque — não é gatilho de marketing inventado. */}
      {disponivel <= 3 && (
        <p className="mt-3 text-sm font-semibold text-marca">
          {disponivel === 1
            ? "Última unidade nesta medida"
            : `Restam apenas ${disponivel} unidades`}
        </p>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm font-semibold text-marca">
          {erro}
        </p>
      )}
    </div>
  );
}
