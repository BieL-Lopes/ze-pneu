import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/sessao-admin";
import { listarSaldos, POR_PAGINA, type FiltroDeEstoque } from "@/db/consultas-do-painel";
import { formatBRL } from "@/lib/format";
import { Botao, classesDeCampo } from "@/components/ui/botao";
import { CabecalhoDaPagina } from "@/components/painel/cabecalho-da-pagina";
import { PaginacaoDoPainel, paginaDe, textoDe } from "@/components/painel/paginacao-do-painel";

export const metadata: Metadata = { title: "Estoque" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const SITUACOES: Record<FiltroDeEstoque, string> = {
  todos: "Todas as medidas",
  sem_estoque: "Sem estoque",
  baixo: "Estoque baixo (1 a 4)",
};

export default async function EstoquePage({ searchParams }: Props) {
  await exigirUsuario("estoque");
  const consulta = await searchParams;
  const bruto = textoDe(consulta.situacao);
  const situacao: FiltroDeEstoque = bruto in SITUACOES ? (bruto as FiltroDeEstoque) : "todos";
  const busca = textoDe(consulta.busca);
  const pagina = paginaDe(consulta.pagina);

  const { linhas, total } = await listarSaldos({ busca, situacao, pagina });

  return (
    <>
      <CabecalhoDaPagina
        titulo="Estoque"
        apoio="Saldo da loja de Brasília. Físico é o que está na prateleira; reservado é o que está em checkout aberto."
      />

      <form className="mt-6 flex flex-wrap gap-3" role="search">
        <label className="sr-only" htmlFor="busca">Buscar</label>
        <input
          id="busca"
          name="busca"
          defaultValue={busca}
          placeholder="SKU, modelo, marca ou medida (205 55 16)"
          className={classesDeCampo("min-w-0 flex-1 basis-64")}
        />
        <label className="sr-only" htmlFor="situacao">Situação</label>
        <select id="situacao" name="situacao" defaultValue={situacao} className={classesDeCampo()}>
          {(Object.keys(SITUACOES) as FiltroDeEstoque[]).map((s) => (
            <option key={s} value={s}>{SITUACOES[s]}</option>
          ))}
        </select>
        <Botao type="submit" variante="escura">Filtrar</Botao>
      </form>

      {linhas.length === 0 ? (
        <p className="mt-10 rounded-controle border border-dashed border-neutral-300 p-10 text-center text-tinta-media">
          Nenhuma medida encontrada.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-controle border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-widest text-tinta-media">
              <tr>
                <th scope="col" className="px-4 py-3">Produto</th>
                <th scope="col" className="px-4 py-3">SKU</th>
                <th scope="col" className="px-4 py-3 text-right">Preço</th>
                <th scope="col" className="px-4 py-3 text-right">Físico</th>
                <th scope="col" className="px-4 py-3 text-right">Reservado</th>
                <th scope="col" className="px-4 py-3 text-right">Disponível</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((l) => (
                <tr key={l.variantId} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/estoque/${encodeURIComponent(l.sku)}`} className="font-bold text-tinta hover:text-marca hover:underline">
                      {l.marca} {l.produto}
                    </Link>
                    {l.medida && <span className="numerais-tabulares block text-xs text-tinta-media">{l.medida}</span>}
                  </td>
                  <td className="numerais-tabulares px-4 py-3 text-tinta-media">{l.sku}</td>
                  <td className="numerais-tabulares px-4 py-3 text-right">{formatBRL(l.priceCents)}</td>
                  <td className="numerais-tabulares px-4 py-3 text-right">{l.onHand}</td>
                  <td className="numerais-tabulares px-4 py-3 text-right text-tinta-media">{l.reserved}</td>
                  <td className={`numerais-tabulares px-4 py-3 text-right font-black ${l.disponivel <= 0 ? "text-marca" : "text-tinta"}`}>
                    {l.disponivel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginacaoDoPainel
        caminho="/admin/estoque"
        pagina={pagina}
        porPagina={POR_PAGINA}
        total={total}
        params={{ situacao: situacao === "todos" ? undefined : situacao, busca: busca || undefined }}
      />
    </>
  );
}
