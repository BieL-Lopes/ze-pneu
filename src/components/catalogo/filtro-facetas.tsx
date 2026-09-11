import Link from "next/link";
import type { FacetCount } from "@/core/catalog/types";

type Props = {
  titulo: string;
  chave: string;
  opcoes: FacetCount[];
  selecionados: string[];
  paramsAtuais: URLSearchParams;
};

/**
 * Faceta como lista de links, não como checkbox com JavaScript.
 *
 * Cada combinação de filtro vira uma URL real: o cliente compartilha o link e
 * o Google indexa "pneu 205/55 R16". Um filtro só no cliente não teria nem uma
 * coisa nem outra.
 */
export function FiltroFacetas({
  titulo,
  chave,
  opcoes,
  selecionados,
  paramsAtuais,
}: Props) {
  if (opcoes.length === 0) return null;

  function hrefAlternando(valor: string) {
    const params = new URLSearchParams(paramsAtuais);
    const novos = selecionados.includes(valor)
      ? selecionados.filter((s) => s !== valor)
      : [...selecionados, valor];

    if (novos.length) params.set(chave, novos.join(","));
    else params.delete(chave);
    // Trocar de filtro sempre volta para a primeira página: a página 4 do
    // filtro anterior quase nunca existe no filtro novo.
    params.delete("pagina");

    const qs = params.toString();
    return qs ? `/pneus?${qs}` : "/pneus";
  }

  return (
    <fieldset className="border-b border-neutral-200 py-4">
      <legend className="mb-2 text-sm font-semibold text-neutral-900">
        {titulo}
      </legend>
      <ul className="space-y-1">
        {opcoes.map((opcao) => {
          const ativo = selecionados.includes(opcao.value);
          return (
            <li key={opcao.value}>
              <Link
                href={hrefAlternando(opcao.value)}
                aria-current={ativo ? "true" : undefined}
                className={`flex justify-between rounded px-2 py-1 text-sm transition hover:bg-neutral-100 ${
                  ativo ? "font-semibold text-neutral-900" : "text-neutral-600"
                }`}
              >
                <span>
                  {ativo ? "✓ " : ""}
                  {opcao.label}
                </span>
                <span className="text-neutral-400">{opcao.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
