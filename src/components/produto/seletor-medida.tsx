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
        <fieldset className="mb-6">
          <legend className="mb-2 text-sm font-semibold text-neutral-900">
            Escolha a medida
          </legend>
          <div className="flex flex-wrap gap-2">
            {variantes.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelecionadaId(v.id)}
                aria-pressed={v.id === selecionadaId}
                className={`rounded border px-3 py-2 text-sm transition ${
                  v.id === selecionadaId
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
                }`}
              >
                {v.sizeLabel ?? v.sku}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-3xl font-bold text-neutral-900">
        {formatBRL(selecionada.priceCents)}
      </p>
      <p className="mt-1 text-sm text-neutral-500">Código: {selecionada.sku}</p>

      {/*
        Desabilitado de propósito: o carrinho é o Plano 2. Deixar o botão
        visível e inerte é honesto com quem navega o preview e evita que o
        layout mude de forma quando o carrinho chegar.
      */}
      <button
        type="button"
        disabled
        title="O carrinho entra na próxima etapa do projeto"
        className="mt-6 w-full rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Adicionar ao carrinho
      </button>
    </div>
  );
}
