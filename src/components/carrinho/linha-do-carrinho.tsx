"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CartItem } from "@/core/cart/types";
import { formatBRL } from "@/lib/format";
import { LIMITE_POR_ITEM } from "@/core/cart/cart-totals";
import {
  definirItemDoCarrinho,
  removerDoCarrinho,
} from "@/app/(loja)/carrinho/acoes";
import { IconeLixeira } from "@/components/icones-carrinho";
import { classesDeCampo } from "@/components/ui/botao";

export function LinhaDoCarrinho({ item }: { item: CartItem }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function acao(fn: (d: FormData) => Promise<unknown>, quantity?: number) {
    iniciar(async () => {
      const dados = new FormData();
      dados.set("variantId", item.variantId);
      if (quantity !== undefined) dados.set("quantity", String(quantity));
      await fn(dados);
      router.refresh();
    });
  }

  const excedeu = item.quantity > item.disponivel;
  // O máximo do seletor considera a quantidade atual mesmo quando ela já passou
  // do estoque: senão o valor selecionado sumiria da lista e o campo ficaria
  // mostrando outro número sem o cliente ter mexido em nada.
  const maximo = Math.min(
    Math.max(item.disponivel, item.quantity),
    LIMITE_POR_ITEM,
  );

  return (
    <li
      className={`flex flex-wrap items-center gap-4 border-t border-neutral-200 py-6 ${
        pendente ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-48 flex-1">
        <Link
          href={`/produto/${item.productSlug}`}
          className="font-bold text-tinta transition hover:text-marca"
        >
          {item.productName}
        </Link>
        {item.sizeLabel && (
          <p className="numerais-tabulares mt-1 text-sm text-tinta-media">
            {item.sizeLabel}
          </p>
        )}
        <p className="mt-1 text-xs text-tinta-media">{item.sku}</p>

        {excedeu && (
          <p role="alert" className="mt-2 text-sm font-semibold text-marca">
            {item.disponivel === 0
              ? "Este item esgotou"
              : `Só temos ${item.disponivel} em estoque`}
          </p>
        )}
      </div>

      <label className="sr-only" htmlFor={`qtd-${item.variantId}`}>
        Quantidade de {item.productName}
      </label>
      <select
        id={`qtd-${item.variantId}`}
        value={item.quantity}
        disabled={pendente || item.disponivel === 0}
        onChange={(e) => acao(definirItemDoCarrinho, Number(e.target.value))}
        className={classesDeCampo("numerais-tabulares px-3 py-2 font-bold")}
      >
        {Array.from({ length: Math.max(maximo, 1) }, (_, i) => i + 1).map(
          (n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ),
        )}
      </select>

      <p className="numerais-tabulares w-32 text-right text-lg font-black text-tinta">
        {formatBRL(item.unitPriceCents * item.quantity)}
      </p>

      <button
        type="button"
        onClick={() => acao(removerDoCarrinho)}
        disabled={pendente}
        aria-label={`Remover ${item.productName} do carrinho`}
        className="p-2 text-tinta-media transition hover:text-marca"
      >
        <IconeLixeira className="h-5 w-5" />
      </button>
    </li>
  );
}
