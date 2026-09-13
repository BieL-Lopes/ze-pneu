import Link from "next/link";

/**
 * Faixa de promoção, vinda da tabela de configuração.
 *
 * Não renderiza nada quando está desligada ou sem texto: faixa vazia no topo
 * da loja é pior do que faixa nenhuma.
 */
export function FaixaPromocional({
  texto,
  link,
}: {
  texto: string | null;
  link: string | null;
}) {
  if (!texto?.trim()) return null;

  const conteudo = (
    <p className="mx-auto max-w-7xl px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white">
      {texto}
    </p>
  );

  if (!link?.trim()) {
    return <aside className="bg-tinta">{conteudo}</aside>;
  }

  return (
    <aside className="bg-tinta transition hover:bg-black">
      <Link href={link} className="block">
        {conteudo}
      </Link>
    </aside>
  );
}
