import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/sessao-admin";
import { getStockRepository } from "@/lib/container";
import { varianteDoEstoque } from "@/db/consultas-do-painel";
import { podeAcessar } from "@/core/admin/papeis";
import type { MovementKind } from "@/core/stock/types";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { FormularioDeAcao } from "@/components/painel/formulario-de-acao";
import { Campo } from "@/components/painel/campo";
import { acaoAjuste, acaoEntrada } from "./acoes";

type Props = { params: Promise<{ sku: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Estoque ${decodeURIComponent((await params).sku)}` };
}

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const ROTULO: Record<MovementKind, string> = {
  entrada: "Entrada",
  reserva: "Reserva",
  liberacao: "Reserva liberada",
  baixa: "Venda",
  estorno: "Devolução",
  ajuste: "Ajuste",
};

/** Efeito do movimento no físico. Reserva e liberação só mexem no reservado. */
function efeitoNoFisico(kind: MovementKind, quantidade: number): number {
  if (kind === "entrada" || kind === "ajuste" || kind === "estorno") return quantidade;
  if (kind === "baixa") return -quantidade;
  return 0;
}

export default async function EstoqueDoSkuPage({ params }: Props) {
  const usuario = await exigirUsuario("estoque");
  const sku = decodeURIComponent((await params).sku);
  const variante = await varianteDoEstoque(sku);
  if (!variante) notFound();

  const estoque = await getStockRepository();
  const [[saldo], extrato] = await Promise.all([
    estoque.disponibilidadeDe([variante.variantId]),
    estoque.extrato(variante.variantId),
  ]);

  // Saldo físico acumulado linha a linha, para o extrato ler como um razão.
  const linhas = extrato.reduce<((typeof extrato)[number] & { fisico: number })[]>((acc, m) => {
    const anterior = acc.at(-1)?.fisico ?? 0;
    acc.push({ ...m, fisico: anterior + efeitoNoFisico(m.kind, m.quantity) });
    return acc;
  }, []);

  const cartoes = [
    { rotulo: "Físico", valor: saldo.onHand, alerta: false },
    { rotulo: "Reservado", valor: saldo.reserved, alerta: false },
    { rotulo: "Disponível para venda", valor: saldo.disponivel, alerta: saldo.disponivel <= 0 },
  ];

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/estoque" className="font-semibold text-tinta-media hover:text-tinta">← Estoque</Link>
      </p>
      <CabecalhoDaPagina
        titulo={`${variante.marca} ${variante.produto}`}
        apoio={
          <span className="numerais-tabulares">
            {variante.medida ? `${variante.medida} · ` : ""}SKU {variante.sku}
            {podeAcessar(usuario.papel, "produtos") && (
              <>
                {" · "}
                <Link href={`/admin/produtos/${variante.produtoId}`} className="underline-offset-2 hover:underline">
                  editar produto
                </Link>
              </>
            )}
          </span>
        }
      />

      <div className="mt-6 grid grid-cols-3 gap-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-controle border border-neutral-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-tinta-media">{c.rotulo}</p>
            <p className={`numerais-tabulares mt-1 text-3xl font-black ${c.alerta ? "text-marca" : "text-tinta"}`}>{c.valor}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Secao titulo="Entrada de mercadoria">
          <FormularioDeAcao
            acao={acaoEntrada.bind(null, variante.variantId, variante.sku)}
            rotulo="Lançar entrada"
            limparAoConcluir
          >
            <Campo rotulo="Quantidade" nome="quantidade" type="number" min={1} step={1} required inputMode="numeric" />
            <Campo rotulo="Origem" nome="motivo" required maxLength={300} placeholder="Ex: NF 4512 — FARAD" />
          </FormularioDeAcao>
        </Secao>
        <Secao titulo="Ajuste (inventário, avaria, perda)">
          <FormularioDeAcao
            acao={acaoAjuste.bind(null, variante.variantId, variante.sku)}
            rotulo="Lançar ajuste"
            variante="escura"
            limparAoConcluir
          >
            <Campo
              rotulo="Unidades"
              nome="delta"
              type="number"
              step={1}
              required
              ajuda="Positivo soma, negativo tira. Ex: -2 para dois pneus avariados."
            />
            <Campo rotulo="Motivo" nome="motivo" required maxLength={300} placeholder="Ex: contagem de inventário de outubro" />
          </FormularioDeAcao>
        </Secao>
      </div>

      <Secao titulo="Extrato" className="mt-6">
        {linhas.length === 0 ? (
          <p className="text-sm text-tinta-media">Nenhum movimento ainda. Lance a primeira entrada acima.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-tinta-media">
                <tr>
                  <th scope="col" className="py-2 pr-3">Quando</th>
                  <th scope="col" className="py-2 pr-3">Movimento</th>
                  <th scope="col" className="py-2 pr-3 text-right">Qtd.</th>
                  <th scope="col" className="py-2 pr-3 text-right">Físico</th>
                  <th scope="col" className="py-2">Motivo / pedido · autor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {[...linhas].reverse().map((m) => {
                  const efeito = m.kind === "baixa" ? -m.quantity : m.quantity;
                  return (
                    <tr key={m.id}>
                      <td className="numerais-tabulares whitespace-nowrap py-2 pr-3 text-tinta-media">
                        {dataHora.format(m.createdAt)}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-tinta">{ROTULO[m.kind]}</td>
                      <td className="numerais-tabulares py-2 pr-3 text-right">
                        {efeito > 0 ? `+${efeito}` : efeito}
                      </td>
                      <td className="numerais-tabulares py-2 pr-3 text-right font-bold">{m.fisico}</td>
                      <td className="py-2 text-tinta-media">
                        {m.orderRef && (
                          <Link href={`/admin/pedidos/${m.orderRef}`} className="numerais-tabulares font-semibold text-tinta hover:underline">
                            {m.orderRef}
                          </Link>
                        )}
                        {m.orderRef && m.reason ? " · " : ""}
                        {m.reason}
                        {m.authorId ? ` · ${m.authorId}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </>
  );
}
