"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-neutral-900 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
      >
        Buscar
      </button>
    </form>
  );
}
