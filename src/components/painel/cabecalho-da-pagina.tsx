import type { ReactNode } from "react";

export function CabecalhoDaPagina({
  titulo,
  apoio,
  acoes,
}: {
  titulo: string;
  apoio?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-tinta pb-5">
      <div>
        <h1 className="text-3xl font-black uppercase italic tracking-tight text-tinta">{titulo}</h1>
        {apoio && <div className="mt-1.5 text-sm text-tinta-media">{apoio}</div>}
      </div>
      {acoes && <div className="flex flex-wrap gap-3">{acoes}</div>}
    </header>
  );
}

/** Bloco de conteúdo do painel: título pequeno em caixa alta e o conteúdo. */
export function Secao({ titulo, children, className = "" }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-controle border border-neutral-200 bg-white p-5 ${className}`}>
      <h2 className="text-sm font-black uppercase tracking-widest text-tinta">{titulo}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
