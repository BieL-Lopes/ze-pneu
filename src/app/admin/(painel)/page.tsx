import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/sessao-admin";
import { resumoDoPainel } from "@/db/consultas-do-painel";
import { podeAcessar } from "@/core/admin/papeis";
import { formatBRL } from "@/lib/format";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { textoDe } from "@/components/painel/paginacao-do-painel";

export const metadata: Metadata = { title: "Resumo" };

const PERIODOS = { "7": "7 dias", "30": "30 dias", "90": "90 dias" } as const;
type Periodo = keyof typeof PERIODOS;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DIA = 24 * 60 * 60 * 1000;

export default async function ResumoPage({ searchParams }: Props) {
  const usuario = await exigirUsuario();
  const consulta = await searchParams;
  const bruto = textoDe(consulta.periodo);
  const periodo: Periodo = bruto in PERIODOS ? (bruto as Periodo) : "30";

  const ate = new Date();
  const desde = new Date(ate.getTime() - Number(periodo) * DIA);
  const r = await resumoDoPainel(desde, ate);

  const aTratar = (r.porStatus.pago ?? 0) + (r.porStatus.em_separacao ?? 0);
  const aguardandoRetirada = r.porStatus.pronto_para_retirada ?? 0;
  const ticket = r.vendas.pedidos ? Math.round(r.vendas.totalCents / r.vendas.pedidos) : 0;
  const maiorDia = Math.max(1, ...r.porDia.map((d) => d.totalCents));

  return (
    <>
      {consulta["sem-permissao"] && (
        <p role="alert" className="mb-6 rounded-controle bg-marca px-4 py-3 text-sm font-bold text-white">
          Seu acesso não inclui aquela área. Fale com um administrador.
        </p>
      )}

      <CabecalhoDaPagina
        titulo={`Olá, ${usuario.nome.split(" ")[0]}`}
        apoio="O que precisa de atenção e como a loja está vendendo."
        acoes={
          <nav aria-label="Período" className="flex gap-1">
            {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
              <Link
                key={p}
                href={`/admin?periodo=${p}`}
                aria-current={p === periodo ? "page" : undefined}
                className={`rounded-controle px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                  p === periodo ? "bg-tinta text-white" : "border border-neutral-300 text-tinta hover:border-tinta"
                }`}
              >
                {PERIODOS[p]}
              </Link>
            ))}
          </nav>
        }
      />

      {podeAcessar(usuario.papel, "pedidos") && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/admin/pedidos?status=a_tratar"
            className={`rounded-controle p-5 transition ${aTratar ? "bg-marca text-white hover:bg-marca-escura" : "border border-neutral-200 bg-white"}`}
          >
            <p className="numerais-tabulares text-4xl font-black">{aTratar}</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-wide">Pedidos pagos para separar</p>
          </Link>
          <Link href="/admin/pedidos?status=pronto_para_retirada" className="rounded-controle border border-neutral-200 bg-white p-5 hover:border-tinta">
            <p className="numerais-tabulares text-4xl font-black text-tinta">{aguardandoRetirada}</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-wide text-tinta-media">Esperando retirada</p>
          </Link>
          <Link href="/admin/estoque?situacao=sem_estoque" className="rounded-controle border border-neutral-200 bg-white p-5 hover:border-tinta">
            <p className="numerais-tabulares text-4xl font-black text-tinta">{r.skusSemEstoque}</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-wide text-tinta-media">Medidas à venda sem estoque</p>
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-controle border border-neutral-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-tinta-media">Vendido em {PERIODOS[periodo]}</p>
          <p className="numerais-tabulares mt-2 text-3xl font-black text-tinta">{formatBRL(r.vendas.totalCents)}</p>
        </div>
        <div className="rounded-controle border border-neutral-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-tinta-media">Pedidos pagos</p>
          <p className="numerais-tabulares mt-2 text-3xl font-black text-tinta">{r.vendas.pedidos}</p>
        </div>
        <div className="rounded-controle border border-neutral-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-tinta-media">Ticket médio</p>
          <p className="numerais-tabulares mt-2 text-3xl font-black text-tinta">{formatBRL(ticket)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Secao titulo="Vendas por dia">
          {r.porDia.length === 0 ? (
            <p className="text-sm text-tinta-media">Nenhuma venda paga no período.</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Total vendido por dia</caption>
              <tbody>
                {r.porDia.map((d) => (
                  <tr key={d.dia}>
                    <th scope="row" className="numerais-tabulares w-20 py-1 pr-3 text-left font-semibold text-tinta-media">
                      {d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}
                    </th>
                    <td className="py-1">
                      <div className="h-4 rounded-sm bg-marca" style={{ width: `${Math.max(2, (d.totalCents / maiorDia) * 100)}%` }} />
                    </td>
                    <td className="numerais-tabulares w-28 py-1 pl-3 text-right font-bold text-tinta">
                      {formatBRL(d.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Secao>

        <Secao titulo="Mais vendidos">
          {r.maisVendidos.length === 0 ? (
            <p className="text-sm text-tinta-media">Nenhuma venda paga no período.</p>
          ) : (
            <ol className="divide-y divide-neutral-100 text-sm">
              {r.maisVendidos.map((p, i) => (
                <li key={p.sku} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    <span className="numerais-tabulares mr-2 font-black text-tinta-clara">{i + 1}</span>
                    <span className="font-bold text-tinta">{p.produto}</span>
                    {p.medida && <span className="numerais-tabulares ml-2 text-tinta-media">{p.medida}</span>}
                  </span>
                  <span className="numerais-tabulares whitespace-nowrap text-right">
                    <span className="font-bold text-tinta">{p.unidades} un.</span>
                    <span className="ml-2 text-tinta-media">{formatBRL(p.receitaCents)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Secao>
      </div>
    </>
  );
}
