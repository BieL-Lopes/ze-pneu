import { BotaoLink } from "@/components/ui/botao";

export function PaginacaoDoPainel({
  caminho,
  pagina,
  porPagina,
  total,
  params,
}: {
  caminho: string;
  pagina: number;
  porPagina: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  if (ultima === 1) return null;

  function href(destino: number) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "pagina") q.set(k, v);
    if (destino > 1) q.set("pagina", String(destino));
    const qs = q.toString();
    return qs ? `${caminho}?${qs}` : caminho;
  }

  return (
    <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-4">
      {pagina > 1 ? (
        <BotaoLink href={href(pagina - 1)} variante="sutil" tamanho="pequeno" rel="prev">
          Anterior
        </BotaoLink>
      ) : (
        <span />
      )}
      <span className="numerais-tabulares text-sm text-tinta-media">
        Página {pagina} de {ultima} · {total} no total
      </span>
      {pagina < ultima ? (
        <BotaoLink href={href(pagina + 1)} variante="sutil" tamanho="pequeno" rel="next">
          Próxima
        </BotaoLink>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Lê ?pagina= sem confiar no valor: qualquer coisa estranha vira página 1. */
export function paginaDe(valor: string | string[] | undefined): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}

export function textoDe(valor: string | string[] | undefined): string {
  return ((Array.isArray(valor) ? valor[0] : valor) ?? "").slice(0, 100);
}
