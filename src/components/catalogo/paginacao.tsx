import Link from "next/link";

type Props = {
  page: number;
  perPage: number;
  total: number;
  paramsAtuais: URLSearchParams;
};

export function Paginacao({ page, perPage, total, paramsAtuais }: Props) {
  const ultimaPagina = Math.max(1, Math.ceil(total / perPage));
  if (ultimaPagina === 1) return null;

  function href(destino: number) {
    const params = new URLSearchParams(paramsAtuais);
    if (destino === 1) params.delete("pagina");
    else params.set("pagina", String(destino));
    const qs = params.toString();
    return qs ? `/pneus?${qs}` : "/pneus";
  }

  const ativo =
    "border border-tinta px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-tinta transition hover:bg-marca hover:border-marca hover:text-white";
  const inerte =
    "border border-neutral-200 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-neutral-300";

  return (
    <nav
      aria-label="Paginação"
      className="mt-12 flex items-center justify-center gap-4"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={ativo} rel="prev">
          Anterior
        </Link>
      ) : (
        <span className={inerte}>Anterior</span>
      )}

      <span className="numerais-tabulares text-sm text-tinta-media">
        Página {page} de {ultimaPagina}
      </span>

      {page < ultimaPagina ? (
        <Link href={href(page + 1)} className={ativo} rel="next">
          Próxima
        </Link>
      ) : (
        <span className={inerte}>Próxima</span>
      )}
    </nav>
  );
}
