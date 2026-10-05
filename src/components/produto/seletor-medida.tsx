"use client";

import { formatBRL } from "@/lib/format";
import { BotaoAdicionar } from "@/components/produto/botao-adicionar";
import { classesDeBotao } from "@/components/ui/botao";
import { useSelecaoDeMedida } from "@/components/produto/selecao-de-medida";

export function SeletorMedida() {
  const { variantes, selecionada, selecionar } = useSelecaoDeMedida();

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
                  onClick={() => selecionar(v.id)}
                  aria-pressed={v.id === selecionada.id}
                  className={classesDeBotao({
                    variante: v.id === selecionada.id ? "primaria" : "sutil",
                    tamanho: "pequeno",
                    extra: `numerais-tabulares ${
                      esgotada && v.id !== selecionada.id
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
