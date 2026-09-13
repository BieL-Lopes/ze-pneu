"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { definirItemDoCarrinho } from "@/app/(loja)/carrinho/acoes";
import { IconeCarrinho } from "@/components/icones-carrinho";
import { LIMITE_POR_ITEM } from "@/core/cart/cart-totals";
import { Botao, classesDeCampo } from "@/components/ui/botao";

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
      <p className="mt-8 rounded-controle border border-neutral-300 px-6 py-4 text-center text-sm font-bold uppercase tracking-wide text-tinta-media">
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
          className={classesDeCampo("numerais-tabulares py-4 font-bold")}
        >
          {Array.from({ length: maximo }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <Botao
          onClick={adicionar}
          disabled={pendente}
          tamanho="grande"
          className="flex-1 disabled:bg-marca disabled:opacity-60"
        >
          <IconeCarrinho className="h-5 w-5" />
          {pendente ? "Adicionando..." : "Adicionar ao carrinho"}
        </Botao>
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
