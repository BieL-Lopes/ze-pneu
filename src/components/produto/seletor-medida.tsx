"use client";

import { useState } from "react";
import type { VariantDetail } from "@/core/catalog/types";
import { formatBRL } from "@/lib/format";
import { BotaoAdicionar } from "@/components/produto/botao-adicionar";
import { classesDeBotao } from "@/components/ui/botao";

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
            {variantes.map((v) => {
              const esgotada = v.disponivel <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelecionadaId(v.id)}
                  aria-pressed={v.id === selecionadaId}
                  className={classesDeBotao({
                    variante: v.id === selecionadaId ? "primaria" : "sutil",
                    tamanho: "pequeno",
                    extra: `numerais-tabulares ${
                      esgotada && v.id !== selecionadaId
                        ? "border-neutral-200 text-neutral-400 line-through"
                        : ""
                    }`,
                  })}
                >
                  {v.sizeLabel ?? v.sku}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <p className="numerais-tabulares text-4xl font-black text-tinta">
        {formatBRL(selecionada.priceCents)}
      </p>
      <p className="mt-1 text-sm text-tinta-media">Código: {selecionada.sku}</p>

      <BotaoAdicionar
        variantId={selecionada.id}
        disponivel={selecionada.disponivel}
      />
    </div>
  );
}
