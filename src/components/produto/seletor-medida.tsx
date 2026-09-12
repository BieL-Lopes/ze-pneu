"use client";

import { useState } from "react";
import type { VariantDetail } from "@/core/catalog/types";
import { formatBRL } from "@/lib/format";

export function SeletorMedida({ variantes }: { variantes: VariantDetail[] }) {
  const [selecionadaId, setSelecionadaId] = useState(variantes[0]?.id ?? "");
  const selecionada =
    variantes.find((v) => v.id === selecionadaId) ?? variantes[0];

  if (!selecionada) return null;

  return (
    <div>
      {variantes.length > 1 && (
        <fieldset className="mb-8">
          <legend className="mb-3 text-xs font-bold uppercase tracking-widest text-tinta">
            Escolha a medida
          </legend>
          <div className="flex flex-wrap gap-2">
            {variantes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelecionadaId(v.id)}
                aria-pressed={v.id === selecionadaId}
                className={`numerais-tabulares border px-4 py-2.5 text-sm font-bold transition ${
                  v.id === selecionadaId
                    ? "border-marca bg-marca text-white"
                    : "border-neutral-300 text-tinta hover:border-tinta"
                }`}
              >
                {v.sizeLabel ?? v.sku}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="numerais-tabulares text-4xl font-black text-tinta">
        {formatBRL(selecionada.priceCents)}
      </p>
      <p className="mt-1 text-sm text-tinta-media">
        Código: {selecionada.sku}
      </p>

      {/*
        Desabilitado de propósito: o carrinho é a próxima etapa do projeto.
        Deixar o botão visível e inerte é honesto com quem navega o preview e
        evita que o layout mude de forma quando o carrinho chegar.
      */}
      <button
        type="button"
        disabled
        title="O carrinho entra na próxima etapa do projeto"
        className="mt-8 w-full bg-marca px-6 py-4 text-base font-bold uppercase tracking-wide text-white transition hover:bg-marca-escura disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        Adicionar ao carrinho
      </button>
    </div>
  );
}
