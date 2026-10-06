import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/sessao-admin";
import { getConfiguracoes, getOrderRepository, linkDoPedido } from "@/lib/container";
import { pagamentosDoPedido } from "@/db/consultas-do-painel";
import { ROTULO_STATUS, type OrderStatus } from "@/core/orders/order-status";
import { proximosStatus } from "@/core/orders/gestao-de-pedidos";
import { linkDeConversa, mensagemDeStatus } from "@/core/orders/aviso-whatsapp";
import { formatarCep } from "@/core/shipping/cep";
import { formatBRL } from "@/lib/format";
import { classesDeBotao, classesDeCampo } from "@/components/ui/botao";
import { IconeWhatsApp } from "@/components/icones";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { SeloDeStatus } from "@/components/painel/selo-de-status";
import { FormularioDeAcao } from "@/components/painel/formulario-de-acao";
import { Campo } from "@/components/painel/campo";
import { acaoAnotar, acaoMudarStatus, acaoNotaFiscal, acaoRastreio } from "./acoes";

type Props = { params: Promise<{ referencia: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Pedido ${(await params).referencia}` };
}

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const ROTULO_DO_BOTAO: Partial<Record<OrderStatus, string>> = {
  em_separacao: "Começar a separar",
  pronto_para_retirada: "Pronto para retirada",
  enviado: "Marcar como enviado",
  entregue: "Confirmar entrega",
  retirado: "Cliente retirou",
  cancelado: "Cancelar pedido",
  estornado: "Marcar como estornado",
};

const CONFIRMACAO: Partial<Record<OrderStatus, string>> = {
  cancelado: "Cancelar este pedido? Os pneus voltam ao estoque. Se já foi pago, o estorno no Mercado Pago é feito à parte.",
  estornado: "Marcar como estornado? Use depois de devolver o dinheiro no Mercado Pago.",
};

function cpfFormatado(cpf: string) {
  return cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;
}

function telefoneFormatado(t: string) {
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return t;
}

export default async function PedidoDoPainelPage({ params }: Props) {
  await exigirUsuario("pedidos");
  const { referencia } = await params;

  const pedidos = getOrderRepository();
  const pedido = await pedidos.porReferencia(referencia);
  if (!pedido) notFound();

  const [eventos, pagamentos, config] = await Promise.all([
    pedidos.eventos(referencia),
    pagamentosDoPedido(pedido.id),
    getConfiguracoes(["retirada_endereco"]),
  ]);

  const r = pedido.recebimento;
  const proximos = proximosStatus(pedido.status, r.tipo);
  const avanco = proximos.filter((s) => s !== "cancelado" && s !== "estornado");
  const desfazer = proximos.filter((s) => s === "cancelado" || s === "estornado");
  const aviso = linkDeConversa(
    pedido.comprador.telefone,
    mensagemDeStatus(pedido, linkDoPedido(pedido.reference, pedido.accessToken)),
  );

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/pedidos" className="font-semibold text-tinta-media hover:text-tinta">← Pedidos</Link>
      </p>
      <CabecalhoDaPagina
        titulo={`Pedido ${pedido.reference}`}
        apoio={
          <span className="flex flex-wrap items-center gap-3">
            <SeloDeStatus status={pedido.status} />
            <span className="numerais-tabulares">Feito em {dataHora.format(pedido.createdAt)}</span>
          </span>
        }
        acoes={
          aviso && (
            <a href={aviso} target="_blank" rel="noopener noreferrer" className={classesDeBotao({ variante: "contorno", tamanho: "pequeno" })}>
              <IconeWhatsApp className="h-4 w-4" />
              Avisar cliente do status
            </a>
          )
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {proximos.length > 0 && (
            <Secao titulo="Próximo passo">
              {pedido.status === "aguardando_pagamento" && (
                <p className="mb-4 text-sm text-tinta-media">
                  O pagamento é confirmado sozinho pelo Mercado Pago. Sem pagamento, o pedido é cancelado em{" "}
                  {dataHora.format(pedido.expiresAt)} e o estoque volta.
                </p>
              )}
              <div className="flex flex-wrap items-start gap-3">
                {avanco.map((s) => (
                  <FormularioDeAcao
                    key={s}
                    acao={acaoMudarStatus.bind(null, pedido.reference, s)}
                    rotulo={ROTULO_DO_BOTAO[s] ?? ROTULO_STATUS[s]}
                    classeDosCampos="space-y-2"
                  >
                    {s === "enviado" && (
                      <Campo
                        rotulo="Código de rastreio"
                        nome="rastreio"
                        defaultValue={pedido.rastreio ?? ""}
                        placeholder="Ex: AA123456789BR"
                        maxLength={60}
                      />
                    )}
                  </FormularioDeAcao>
                ))}
              </div>
              {desfazer.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3 border-t border-neutral-100 pt-4">
                  {desfazer.map((s) => (
                    <FormularioDeAcao
                      key={s}
                      acao={acaoMudarStatus.bind(null, pedido.reference, s)}
                      rotulo={ROTULO_DO_BOTAO[s] ?? ROTULO_STATUS[s]}
                      variante="sutil"
                      tamanho="pequeno"
                      confirmar={CONFIRMACAO[s]}
                    />
                  ))}
                </div>
              )}
            </Secao>
          )}

          <Secao titulo="Itens">
            <ul className="divide-y divide-neutral-100 text-sm">
              {pedido.itens.map((i) => (
                <li key={i.sku} className="flex justify-between gap-4 py-2.5">
                  <span>
                    <span className="block font-bold text-tinta">
                      {i.quantity}× {i.productName}
                    </span>
                    <span className="numerais-tabulares block text-tinta-media">
                      {i.sizeLabel ? `${i.sizeLabel} · ` : ""}
                      <Link href={`/admin/estoque/${encodeURIComponent(i.sku)}`} className="underline-offset-2 hover:underline">
                        {i.sku}
                      </Link>
                    </span>
                  </span>
                  <span className="numerais-tabulares whitespace-nowrap font-bold text-tinta">
                    {formatBRL(i.unitPriceCents * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-neutral-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-tinta-media">Produtos</dt>
                <dd className="numerais-tabulares">{formatBRL(pedido.itemsTotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-media">{r.tipo === "retirada" ? "Retirada" : "Frete"}</dt>
                <dd className="numerais-tabulares">{pedido.shippingCents ? formatBRL(pedido.shippingCents) : "Grátis"}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="font-bold text-tinta">Total</dt>
                <dd className="numerais-tabulares font-black text-tinta">{formatBRL(pedido.totalCents)}</dd>
              </div>
            </dl>
          </Secao>

          <Secao titulo="Histórico">
            <ol className="space-y-3 text-sm">
              {[...eventos].reverse().map((e, i) => (
                <li key={i} className="border-l-2 border-neutral-200 pl-3">
                  <p className="font-bold text-tinta">
                    {e.fromStatus !== e.toStatus ? ROTULO_STATUS[e.toStatus] : "Anotação"}
                  </p>
                  {e.note && <p className="text-tinta">{e.note}</p>}
                  <p className="numerais-tabulares text-xs text-tinta-media">
                    {dataHora.format(e.createdAt)} · {e.autor ?? "sistema"}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-5 border-t border-neutral-100 pt-4">
              <FormularioDeAcao
                acao={acaoAnotar.bind(null, pedido.reference)}
                rotulo="Anotar"
                variante="sutil"
                tamanho="pequeno"
                limparAoConcluir
              >
                <label htmlFor="texto" className="sr-only">Anotação</label>
                <textarea
                  id="texto"
                  name="texto"
                  rows={2}
                  maxLength={1000}
                  placeholder="Ex: cliente pediu para retirar no sábado"
                  className={classesDeCampo("w-full")}
                />
              </FormularioDeAcao>
            </div>
          </Secao>
        </div>

        <div className="space-y-4">
          <Secao titulo="Cliente">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="sr-only">Nome</dt>
                <dd className="font-bold text-tinta">{pedido.comprador.nome}</dd>
              </div>
              <div>
                <dt className="text-xs text-tinta-media">CPF</dt>
                <dd className="numerais-tabulares">{cpfFormatado(pedido.comprador.cpf)}</dd>
              </div>
              <div>
                <dt className="text-xs text-tinta-media">WhatsApp</dt>
                <dd className="numerais-tabulares">{telefoneFormatado(pedido.comprador.telefone)}</dd>
              </div>
              <div>
                <dt className="text-xs text-tinta-media">E-mail</dt>
                <dd className="break-all">
                  <a href={`mailto:${pedido.comprador.email}`} className="hover:underline">{pedido.comprador.email}</a>
                </dd>
              </div>
            </dl>
          </Secao>

          <Secao titulo={r.tipo === "retirada" ? "Retirada em Brasília" : "Entrega"}>
            {r.tipo === "retirada" ? (
              <p className="text-sm text-tinta">{config.retirada_endereco ?? "Loja Zé Pneu em Brasília"}</p>
            ) : (
              <>
                <address className="text-sm not-italic text-tinta">
                  {r.endereco.rua}, {r.endereco.numero}
                  {r.endereco.complemento ? ` — ${r.endereco.complemento}` : ""}
                  <br />
                  {r.endereco.bairro}, {r.endereco.cidade}/{r.endereco.uf}
                  <br />
                  CEP {formatarCep(r.endereco.cep)}
                </address>
                <p className="mt-3 text-sm text-tinta-media">
                  {r.frete.transportadora} · {r.frete.servico} · até {r.frete.prazoDias} dias úteis
                </p>
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <FormularioDeAcao acao={acaoRastreio.bind(null, pedido.reference)} rotulo="Salvar rastreio" variante="sutil" tamanho="pequeno">
                    <Campo rotulo="Código de rastreio" nome="rastreio" defaultValue={pedido.rastreio ?? ""} maxLength={60} />
                  </FormularioDeAcao>
                </div>
              </>
            )}
          </Secao>

          <Secao titulo="Nota fiscal">
            <FormularioDeAcao acao={acaoNotaFiscal.bind(null, pedido.reference)} rotulo="Salvar nota" variante="sutil" tamanho="pequeno">
              <Campo rotulo="Número" nome="numero" defaultValue={pedido.notaFiscal?.numero ?? ""} maxLength={20} />
              <Campo
                rotulo="Chave de acesso"
                nome="chave"
                defaultValue={pedido.notaFiscal?.chave ?? ""}
                inputMode="numeric"
                maxLength={60}
                ajuda="44 dígitos. Opcional."
              />
            </FormularioDeAcao>
          </Secao>

          <Secao titulo="Pagamento">
            {pagamentos.length === 0 ? (
              <p className="text-sm text-tinta-media">Nenhuma tentativa de pagamento registrada.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {pagamentos.map((p) => (
                  <li key={p.id}>
                    <p className="font-bold capitalize text-tinta">
                      {p.status} · {formatBRL(p.valorCents)}
                    </p>
                    <p className="numerais-tabulares text-xs text-tinta-media">
                      {p.provedor} #{p.id} · {p.metodo ?? "meio não informado"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      </div>
    </>
  );
}
