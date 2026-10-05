"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { VariantDetail } from "@/core/catalog/types";

type Selecao = {
  variantes: VariantDetail[];
  selecionada: VariantDetail | undefined;
  selecionar: (id: string) => void;
};

const Contexto = createContext<Selecao | null>(null);

/**
 * Medida escolhida, compartilhada pela página do produto.
 *
 * O seletor fica na coluna da direita e as especificações técnicas abaixo da
 * foto: as duas partes precisam da mesma escolha, e o restante da página
 * continua renderizado no servidor dentro deste provedor.
 */
export function SelecaoDeMedida({
  variantes,
  children,
}: {
  variantes: VariantDetail[];
  children: ReactNode;
}) {
  const [selecionadaId, setSelecionadaId] = useState(variantes[0]?.id ?? "");
  const selecionada =
    variantes.find((v) => v.id === selecionadaId) ?? variantes[0];

  return (
    <Contexto.Provider
      value={{ variantes, selecionada, selecionar: setSelecionadaId }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useSelecaoDeMedida(): Selecao {
  const selecao = useContext(Contexto);
  if (!selecao) {
    throw new Error("useSelecaoDeMedida fora de <SelecaoDeMedida>");
  }
  return selecao;
}
