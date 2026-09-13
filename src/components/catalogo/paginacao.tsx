import { BotaoLink, classesDeBotao } from "@/components/ui/botao";

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

  // Extremo sem destino vira <span>: um link que não leva a lugar nenhum
  // continua recebendo foco do teclado e é anunciado como link pelo leitor
  // de tela.
  const inerte = classesDeBotao({
    variante: "sutil",
    extra: "border-neutral-200 text-neutral-300",
  });

  return (
    <nav
      aria-label="Paginação"
      className="mt-12 flex items-center justify-center gap-4"
    >
      {page > 1 ? (
        <BotaoLink href={href(page - 1)} variante="contorno" rel="prev">
          Anterior
        </BotaoLink>
      ) : (
        <span className={inerte} aria-hidden="true">
          Anterior
        </span>
      )}

      <span className="numerais-tabulares text-sm text-tinta-media">
        Página {page} de {ultimaPagina}
      </span>

      {page < ultimaPagina ? (
        <BotaoLink href={href(page + 1)} variante="contorno" rel="next">
          Próxima
        </BotaoLink>
      ) : (
        <span className={inerte} aria-hidden="true">
          Próxima
        </span>
      )}
    </nav>
  );
}
