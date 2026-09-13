"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LARGURAS, PERFIS, AROS } from "@/core/catalog/medidas-padrao";
import { IconeBusca } from "@/components/icones";
import { Botao, classesDeCampo } from "@/components/ui/botao";

type Campo = "largura" | "perfil" | "aro";

/**
 * Seletores de medida.
 *
 * A pessoa lê os três números na lateral do pneu e escolhe. É como se compra
 * pneu no Brasil — o campo de texto livre do cabeçalho exige saber digitar o
 * formato, e quem não sabe desiste.
 *
 * Os três campos são opcionais: só o aro já é uma busca útil.
 */
export function BuscaPorMedida() {
  const [valores, setValores] = useState<Record<Campo, string>>({
    largura: "",
    perfil: "",
    aro: "",
  });
  const router = useRouter();

  function definir(campo: Campo, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (valores.largura) params.set("largura", valores.largura);
    if (valores.perfil) params.set("perfil", valores.perfil);
    if (valores.aro) params.set("aro", valores.aro);

    const qs = params.toString();
    router.push(qs ? `/pneus?${qs}` : "/pneus");
  }

  const campos: { campo: Campo; rotulo: string; opcoes: readonly number[] }[] = [
    { campo: "largura", rotulo: "Largura", opcoes: LARGURAS },
    { campo: "perfil", rotulo: "Perfil", opcoes: PERFIS },
    { campo: "aro", rotulo: "Aro", opcoes: AROS },
  ];

  return (
    <form
      onSubmit={buscar}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,1fr)_auto]"
    >
      {campos.map(({ campo, rotulo, opcoes }) => (
        <div key={campo}>
          <label
            htmlFor={`medida-${campo}`}
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-tinta"
          >
            {rotulo}
          </label>
          <select
            id={`medida-${campo}`}
            value={valores[campo]}
            onChange={(e) => definir(campo, e.target.value)}
            className={classesDeCampo("numerais-tabulares w-full py-3.5 font-bold")}
          >
            <option value="">Todas</option>
            {opcoes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="flex items-end sm:col-span-2 lg:col-span-1">
        <Botao type="submit" tamanho="grande" larguraTotal className="py-3.5">
          <IconeBusca className="h-5 w-5" />
          Buscar
        </Botao>
      </div>
    </form>
  );
}
