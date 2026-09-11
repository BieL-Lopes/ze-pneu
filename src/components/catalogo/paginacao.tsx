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

  const classe =
    "rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100";

  return (
    <nav
      aria-label="Paginação"
      className="mt-8 flex items-center justify-center gap-4"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={classe} rel="prev">
          Anterior
        </Link>
      ) : (
        <span className={`${classe} opacity-40`}>Anterior</span>
      )}

      <span className="text-sm text-neutral-600">
        Página {page} de {ultimaPagina}
      </span>

      {page < ultimaPagina ? (
        <Link href={href(page + 1)} className={classe} rel="next">
          Próxima
        </Link>
      ) : (
        <span className={`${classe} opacity-40`}>Próxima</span>
      )}
    </nav>
  );
}
