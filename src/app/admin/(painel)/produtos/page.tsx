import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/sessao-admin";
import { listarProdutos, POR_PAGINA } from "@/db/consultas-do-painel";
import { ROTULO_STATUS_PRODUTO, STATUS_DE_PRODUTO, type StatusDeProduto } from "@/core/catalog/cadastro";
import { formatBRL } from "@/lib/format";
import { Botao, BotaoLink, classesDeCampo } from "@/components/ui/botao";
import { CabecalhoDaPagina } from "@/components/painel/cabecalho-da-pagina";
import { PaginacaoDoPainel, paginaDe, textoDe } from "@/components/painel/paginacao-do-painel";

export const metadata: Metadata = { title: "Produtos" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const COR_STATUS: Record<StatusDeProduto, string> = {
  active: "bg-green-100 text-green-900",
  draft: "bg-amber-100 text-amber-900",
  archived: "bg-neutral-200 text-tinta-media",
};

export default async function ProdutosPage({ searchParams }: Props) {
  await exigirUsuario("produtos");
  const consulta = await searchParams;
  const bruto = textoDe(consulta.status);
  const status = (STATUS_DE_PRODUTO as readonly string[]).includes(bruto) ? (bruto as StatusDeProduto) : undefined;
  const busca = textoDe(consulta.busca);
  const pagina = paginaDe(consulta.pagina);

  const { linhas, total } = await listarProdutos({ busca, status, pagina });

  return (
    <>
      <CabecalhoDaPagina
        titulo="Produtos"
        apoio="Modelos, medidas, preços e fotos. Só aparece na loja o que está “À venda” e tem estoque."
        acoes={
          <>
            <BotaoLink href="/admin/produtos/importar" variante="contorno" tamanho="pequeno">
              Importar planilha
            </BotaoLink>
            <BotaoLink href="/admin/produtos/novo" tamanho="pequeno">
              Novo produto
            </BotaoLink>
          </>
        }
      />

      <form className="mt-6 flex flex-wrap gap-3" role="search">
        <label className="sr-only" htmlFor="busca">Buscar</label>
        <input
          id="busca"
          name="busca"
          defaultValue={busca}
          placeholder="Modelo ou marca"
          className={classesDeCampo("min-w-0 flex-1 basis-64")}
        />
        <label className="sr-only" htmlFor="status">Situação</label>
        <select id="status" name="status" defaultValue={status ?? ""} className={classesDeCampo()}>
          <option value="">Todas as situações</option>
          {STATUS_DE_PRODUTO.map((s) => (
            <option key={s} value={s}>{ROTULO_STATUS_PRODUTO[s]}</option>
          ))}
        </select>
        <Botao type="submit" variante="escura">Filtrar</Botao>
      </form>

      {linhas.length === 0 ? (
        <p className="mt-10 rounded-controle border border-dashed border-neutral-300 p-10 text-center text-tinta-media">
          Nenhum produto encontrado.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-100 rounded-controle border border-neutral-200 bg-white">
          {linhas.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/produtos/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-controle bg-neutral-100">
                  {p.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.foto} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-tinta-clara">sem foto</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-tinta">
                    {p.marca} {p.nome}
                  </span>
                  <span className="block text-xs text-tinta-media">
                    {p.categoria} · {p.variantes} medida(s)
                    {p.menorPrecoCents !== null && ` · a partir de ${formatBRL(p.menorPrecoCents)}`}
                  </span>
                </span>
                <span className={`rounded-controle px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${COR_STATUS[p.status]}`}>
                  {ROTULO_STATUS_PRODUTO[p.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <PaginacaoDoPainel
        caminho="/admin/produtos"
        pagina={pagina}
        porPagina={POR_PAGINA}
        total={total}
        params={{ status, busca: busca || undefined }}
      />
    </>
  );
}
