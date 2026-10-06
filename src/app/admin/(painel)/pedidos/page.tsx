import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/sessao-admin";
import { listarPedidos, POR_PAGINA } from "@/db/consultas-do-painel";
import { ORDER_STATUSES } from "@/db/schema";
import { ROTULO_STATUS, type OrderStatus } from "@/core/orders/order-status";
import { formatBRL } from "@/lib/format";
import { classesDeCampo, Botao } from "@/components/ui/botao";
import { CabecalhoDaPagina } from "@/components/painel/cabecalho-da-pagina";
import { SeloDeStatus } from "@/components/painel/selo-de-status";
import { PaginacaoDoPainel, paginaDe, textoDe } from "@/components/painel/paginacao-do-painel";

export const metadata: Metadata = { title: "Pedidos" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const data = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export default async function PedidosPage({ searchParams }: Props) {
  await exigirUsuario("pedidos");
  const consulta = await searchParams;
  const statusBruto = textoDe(consulta.status);
  const status =
    statusBruto === "a_tratar" || (ORDER_STATUSES as readonly string[]).includes(statusBruto)
      ? (statusBruto as OrderStatus | "a_tratar")
      : undefined;
  const busca = textoDe(consulta.busca);
  const pagina = paginaDe(consulta.pagina);

  const { linhas, total } = await listarPedidos({ status, busca, pagina });

  return (
    <>
      <CabecalhoDaPagina titulo="Pedidos" apoio="Do pagamento à entrega. Clique no pedido para mudar o status." />

      <form className="mt-6 flex flex-wrap gap-3" role="search">
        <label className="sr-only" htmlFor="busca">Buscar</label>
        <input
          id="busca"
          name="busca"
          defaultValue={busca}
          placeholder="Referência, nome, e-mail ou telefone"
          className={classesDeCampo("min-w-0 flex-1 basis-64")}
        />
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status ?? ""} className={classesDeCampo()}>
          <option value="">Todos os status</option>
          <option value="a_tratar">A tratar (pagos e em separação)</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
        <Botao type="submit" variante="escura">Filtrar</Botao>
      </form>

      {linhas.length === 0 ? (
        <p className="mt-10 rounded-controle border border-dashed border-neutral-300 p-10 text-center text-tinta-media">
          Nenhum pedido encontrado.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-controle border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-widest text-tinta-media">
              <tr>
                <th scope="col" className="px-4 py-3">Pedido</th>
                <th scope="col" className="px-4 py-3">Cliente</th>
                <th scope="col" className="px-4 py-3">Recebimento</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((p) => (
                <tr key={p.reference} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/pedidos/${p.reference}`} className="numerais-tabulares font-bold text-tinta underline-offset-2 hover:text-marca hover:underline">
                      {p.reference}
                    </Link>
                    <span className="numerais-tabulares block text-xs text-tinta-media">{data.format(p.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3 text-tinta">{p.cliente}</td>
                  <td className="px-4 py-3 text-tinta-media">
                    {p.recebimento === "retirada" ? "Retirada" : `Entrega · ${p.cidade ?? ""}/${p.uf ?? ""}`}
                  </td>
                  <td className="px-4 py-3"><SeloDeStatus status={p.status} /></td>
                  <td className="numerais-tabulares px-4 py-3 text-right font-bold text-tinta">{formatBRL(p.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginacaoDoPainel
        caminho="/admin/pedidos"
        pagina={pagina}
        porPagina={POR_PAGINA}
        total={total}
        params={{ status, busca: busca || undefined }}
      />
    </>
  );
}
