import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { getConfirmacaoDePagamento, getConfiguracoes, getOrderRepository } from "@/lib/container";
import { ROTULO_STATUS, type OrderStatus } from "@/core/orders/order-status";
import { formatarCep } from "@/core/shipping/cep";
import { formatBRL } from "@/lib/format";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { IconeWhatsApp } from "@/components/icones";
import { classesDeBotao } from "@/components/ui/botao";

type Props = {
  params: Promise<{ referencia: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Seu pedido",
  robots: { index: false, follow: false },
  // O token de acesso está na URL: não pode vazar no Referer para o WhatsApp
  // nem para o Mercado Pago.
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

function tokenConfere(esperado: string, recebido: string): boolean {
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

const MENSAGEM: Partial<Record<OrderStatus, string>> = {
  aguardando_pagamento: "Assim que o pagamento for confirmado, separamos seus pneus.",
  pago: "Pagamento confirmado. Já estamos separando seus pneus.",
  em_separacao: "Seus pneus estão sendo separados.",
  enviado: "Seu pedido saiu para entrega.",
  pronto_para_retirada: "Seus pneus estão separados esperando por você.",
  entregue: "Pedido entregue. Boa estrada!",
  retirado: "Pedido retirado. Boa estrada!",
  cancelado: "Este pedido foi cancelado e os pneus voltaram ao estoque.",
  estornado: "O pagamento deste pedido foi estornado.",
};

export default async function PedidoPage({ params, searchParams }: Props) {
  const { referencia } = await params;
  const consulta = await searchParams;
  const token = primeiro(consulta.t);

  const pedidos = getOrderRepository();
  let pedido = await pedidos.porReferencia(referencia);
  // Referência existente com token errado responde igual a referência
  // inexistente: a página não confirma que o pedido existe.
  if (!pedido || !tokenConfere(pedido.accessToken, token)) notFound();

  // Volta do Mercado Pago: confirma já, sem esperar o aviso automático. O id
  // da URL só diz qual pagamento consultar; status e valor vêm da API dele.
  const pagamentoId = primeiro(consulta.payment_id);
  if (pedido.status === "aguardando_pagamento" && /^\d+$/.test(pagamentoId)) {
    try {
      const confirmacao = await getConfirmacaoDePagamento();
      await confirmacao?.processar(pagamentoId);
      pedido = (await pedidos.porReferencia(referencia)) ?? pedido;
    } catch (e) {
      console.error(`Falha ao confirmar o pagamento ${pagamentoId} na volta do checkout`, e);
    }
  }

  const config = await getConfiguracoes(["retirada_endereco", "retirada_horario"]);
  const aguardando = pedido.status === "aguardando_pagamento";
  const podePagar = aguardando && pedido.paymentUrl && pedido.expiresAt > new Date();
  const cancelado = pedido.status === "cancelado" || pedido.status === "estornado";
  const r = pedido.recebimento;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="numerais-tabulares text-sm font-bold uppercase tracking-widest text-tinta-media">
        Pedido {pedido.reference}
      </p>
      <h1 className="mt-2 text-4xl font-black uppercase italic tracking-tight text-tinta">
        {ROTULO_STATUS[pedido.status]}
      </h1>
      <p className={`mt-3 text-lg ${cancelado ? "text-marca" : "text-tinta-media"}`}>
        {MENSAGEM[pedido.status]}
      </p>

      {podePagar && (
        <div className="mt-8 rounded-controle border-2 border-marca p-5">
          <p className="font-bold text-tinta">Ainda não recebemos o pagamento.</p>
          <p className="mt-1 text-sm text-tinta-media">
            Os pneus ficam reservados para você até{" "}
            {pedido.expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.
            Se já pagou com Pix, a confirmação pode levar alguns instantes — recarregue a página.
          </p>
          <a href={pedido.paymentUrl!} className={classesDeBotao({ tamanho: "grande", larguraTotal: true, extra: "mt-4" })}>
            Pagar agora
          </a>
        </div>
      )}

      <section className="mt-12 border-t-4 border-tinta pt-6">
        <h2 className="text-xl font-black uppercase italic tracking-tight text-tinta">Itens</h2>
        <ul className="mt-4 divide-y divide-neutral-200">
          {pedido.itens.map((i) => (
            <li key={i.sku} className="flex justify-between gap-4 py-3">
              <span>
                <span className="block font-bold text-tinta">
                  {i.quantity}× {i.productName}
                </span>
                {i.sizeLabel && <span className="numerais-tabulares block text-sm text-tinta-media">{i.sizeLabel}</span>}
              </span>
              <span className="numerais-tabulares font-bold text-tinta">{formatBRL(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-tinta-media">Produtos</dt>
            <dd className="numerais-tabulares">{formatBRL(pedido.itemsTotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-tinta-media">{r.tipo === "retirada" ? "Retirada" : "Frete"}</dt>
            <dd className="numerais-tabulares">{pedido.shippingCents === 0 ? "Grátis" : formatBRL(pedido.shippingCents)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3">
            <dt className="font-bold uppercase tracking-widest text-tinta-media">Total</dt>
            <dd className="numerais-tabulares text-2xl font-black text-tinta">{formatBRL(pedido.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-12 border-t-4 border-tinta pt-6">
        <h2 className="text-xl font-black uppercase italic tracking-tight text-tinta">
          {r.tipo === "retirada" ? "Retirada em Brasília" : "Entrega"}
        </h2>
        {r.tipo === "retirada" ? (
          <div className="mt-4 text-tinta">
            <p className="font-bold">{config.retirada_endereco ?? "Loja Zé Pneu em Brasília"}</p>
            <p className="mt-1 text-tinta-media">
              {config.retirada_horario ?? "Combinamos o horário pelo WhatsApp após a confirmação do pagamento."}
            </p>
          </div>
        ) : (
          <div className="mt-4 text-tinta">
            <p>
              {r.endereco.rua}, {r.endereco.numero}
              {r.endereco.complemento ? ` — ${r.endereco.complemento}` : ""}
            </p>
            <p className="text-tinta-media">
              {r.endereco.bairro}, {r.endereco.cidade}/{r.endereco.uf} · CEP {formatarCep(r.endereco.cep)}
            </p>
            <p className="mt-3 text-sm text-tinta-media">
              {r.frete.transportadora} · {r.frete.servico}
              {r.frete.prazoDias > 0 && ` · até ${r.frete.prazoDias} dias úteis após o envio`}
            </p>
          </div>
        )}
      </section>

      <div className="mt-12">
        <WhatsAppLink
          mensagem={`Olá! Quero falar sobre o pedido ${pedido.reference}.`}
          className={classesDeBotao({ variante: "contorno", tamanho: "grande", larguraTotal: true })}
        >
          <IconeWhatsApp className="h-5 w-5" />
          Falar sobre este pedido
        </WhatsAppLink>
        <p className="mt-3 text-center text-xs text-tinta-media">
          Guarde este link: é por ele que você acompanha o pedido.
        </p>
      </div>
    </main>
  );
}
