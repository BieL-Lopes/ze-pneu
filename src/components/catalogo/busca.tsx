"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconeBusca } from "@/components/icones";
import { Botao } from "@/components/ui/botao";

export function Busca({ inicial = "" }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  const router = useRouter();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const termo = valor.trim();
    router.push(termo ? `/pneus?q=${encodeURIComponent(termo)}` : "/pneus");
  }

  return (
    <form onSubmit={enviar} role="search" className="flex w-full max-w-lg gap-2">
      <input
        type="search"
        name="q"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Busque pela medida, ex: 205/55 R16"
        aria-label="Buscar pneus"
        className="flex-1 rounded-controle border border-transparent bg-white px-4 py-2 text-sm text-tinta placeholder:text-tinta-media focus:border-marca focus:outline-none"
      />
      <Botao type="submit" tamanho="pequeno">
        <IconeBusca className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar</span>
      </Botao>
    </form>
  );
}
