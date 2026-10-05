"use client";

import { useSelecaoDeMedida } from "@/components/produto/selecao-de-medida";
import { cargaMaximaKg, velocidadeMaximaKmh } from "@/core/catalog/indices";

const TIPO_DE_VEICULO: Record<string, string> = {
  passeio: "Carro de passeio",
  suv: "SUV e caminhonete",
  carga: "Utilitário e van",
  moto: "Moto",
};

/** Especificações da medida escolhida no seletor. */
export function EspecificacoesTecnicas({
  marca,
  desenho,
}: {
  marca: string;
  desenho: string;
}) {
  const { selecionada } = useSelecaoDeMedida();
  if (!selecionada) return null;

  const m = selecionada.medida;
  const carga = m?.loadIndex != null ? cargaMaximaKg(m.loadIndex) : null;
  const velocidade = m?.speedRating ? velocidadeMaximaKmh(m.speedRating) : null;

  const linhas: [string, string | null][] = [
    ["Marca", marca],
    ["Desenho", desenho],
    ["Medida", m ? `${m.width}/${m.profile} R${m.rim}` : null],
    ["Largura", m ? `${m.width} mm` : null],
    ["Perfil", m ? `${m.profile}% da largura` : null],
    ["Aro", m ? `${m.rim}"` : null],
    [
      "Índice de carga",
      m?.loadIndex != null
        ? carga
          ? `${m.loadIndex} — até ${carga.toLocaleString("pt-BR")} kg por pneu`
          : String(m.loadIndex)
        : null,
    ],
    [
      "Índice de velocidade",
      m?.speedRating
        ? velocidade
          ? `${m.speedRating} — até ${velocidade} km/h`
          : m.speedRating
        : null,
    ],
    ["Indicado para", selecionada.vehicleType ? (TIPO_DE_VEICULO[selecionada.vehicleType] ?? null) : null],
    ["Código", selecionada.sku],
  ];

  return (
    <dl className="divide-y divide-neutral-200 border-y border-neutral-200">
      {linhas
        .filter((l): l is [string, string] => l[1] !== null)
        .map(([rotulo, valor]) => (
          <div key={rotulo} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-4 py-3 text-sm">
            <dt className="font-bold text-tinta">{rotulo}</dt>
            <dd className="numerais-tabulares text-tinta-media">{valor}</dd>
          </div>
        ))}
    </dl>
  );
}
