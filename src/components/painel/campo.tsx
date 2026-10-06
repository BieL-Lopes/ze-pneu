import type { ComponentProps, ReactNode } from "react";
import { classesDeCampo } from "@/components/ui/botao";

type Props = {
  rotulo: string;
  nome: string;
  ajuda?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"input">, "name" | "className">;

/** Campo com rótulo em cima e ajuda embaixo — o par que todo formulário do painel repete. */
export function Campo({ rotulo, nome, ajuda, className = "", id, ...resto }: Props) {
  const idDoCampo = id ?? `campo-${nome}`;
  return (
    <div className={className}>
      <label htmlFor={idDoCampo} className="block text-xs font-bold uppercase tracking-widest text-tinta-media">
        {rotulo}
      </label>
      <input id={idDoCampo} name={nome} className={classesDeCampo("mt-1.5 w-full")} {...resto} />
      {ajuda && <p className="mt-1.5 text-xs text-tinta-media">{ajuda}</p>}
    </div>
  );
}

export function rotuloDeCampo() {
  return "block text-xs font-bold uppercase tracking-widest text-tinta-media";
}
