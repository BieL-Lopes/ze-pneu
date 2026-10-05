import type { CartRepository } from "@/core/cart/cart-repository";
import type { CartItem } from "@/core/cart/types";
import type { StockRepository } from "@/core/stock/stock-repository";
import type { FalhaDeEstoque } from "@/core/stock/types";
import type { PaymentProvider } from "@/core/payment/payment-provider";
import type {
  OpcaoDeFrete,
  Pacote,
  ShippingProvider,
} from "@/core/shipping/shipping-provider";
import { type Result, ok, err } from "@/core/shared/result";
import type {
  Comprador,
  EnderecoDeEntrega,
  OrderRepository,
  Recebimento,
} from "./order-repository";
import { gerarReferencia, gerarTokenDeAcesso } from "./referencia";

const MINUTO = 60_000;

/** Quanto tempo o pneu fica separado esperando o pagamento. */
export const VALIDADE_DA_RESERVA_MIN = 60;

/**
 * Prazo para pagar, menor que o da reserva de propósito: o provedor deixa de
 * aceitar pagamento antes de o pneu voltar para a prateleira. Assim não existe
 * pagamento aprovado para um estoque que já foi vendido a outro cliente.
 */
export const VALIDADE_DA_COBRANCA_MIN = 30;

export type EntradaDoCheckout = {
  comprador: Comprador;
  recebimento:
    | { tipo: "retirada" }
    | { tipo: "entrega"; endereco: EnderecoDeEntrega; servicoId: string };
};

type Dependencias = {
  carrinhos: CartRepository;
  estoque: Pick<StockRepository, "reservar" | "liberarReserva" | "liberarVencidas">;
  pedidos: OrderRepository;
  /** Null quando o provedor não está configurado: a entrega fica indisponível. */
  frete: ShippingProvider | null;
  /** Null quando o provedor não está configurado: não há como fechar compra. */
  pagamento: PaymentProvider | null;
  urls: {
    retorno(referencia: string, token: string): string;
    notificacao: string;
  };
  agora?: () => Date;
};

const FALE_CONOSCO = "Tente de novo em instantes ou fale com a gente no WhatsApp.";

function pacotes(itens: CartItem[]): Pacote[] {
  return itens.map((i) => ({
    sku: i.sku,
    quantidade: i.quantity,
    pesoGramas: i.envio.pesoGramas,
    lengthMm: i.envio.lengthMm,
    widthMm: i.envio.widthMm,
    heightMm: i.envio.heightMm,
    valorCents: i.unitPriceCents,
  }));
}

function nomeDoItem(i: CartItem): string {
  return i.sizeLabel ? `${i.productName} ${i.sizeLabel}` : i.productName;
}

function mensagemDeEstoque(falha: FalhaDeEstoque, itens: CartItem[]): string {
  if (falha.tipo === "reserva_inexistente") return `Não foi possível separar o estoque. ${FALE_CONOSCO}`;
  const item = itens.find((i) => i.variantId === falha.variantId);
  const nome = item ? nomeDoItem(item) : "um dos itens";
  if (falha.tipo === "indisponivel" && falha.disponivel > 0) {
    return `Restam só ${falha.disponivel} unidade(s) de ${nome}. Ajuste o carrinho para continuar.`;
  }
  return `${nome} acabou de esgotar. Remova do carrinho para continuar.`;
}

/**
 * Fechamento da compra.
 *
 * Nada que vem do navegador é usado como valor: preço sai do carrinho relido
 * agora, e o frete de uma cotação refeita aqui. O formulário só escolhe — qual
 * serviço, qual endereço.
 */
export function createCheckoutService(deps: Dependencias) {
  const agora = deps.agora ?? (() => new Date());

  async function cotar(itens: CartItem[], cep: string): Promise<Result<OpcaoDeFrete[], string>> {
    if (!deps.frete) return err("Entrega indisponível no momento. Escolha a retirada em Brasília.");
    return deps.frete.cotar({ cepDestino: cep, pacotes: pacotes(itens) });
  }

  const servico = {
    async cotarFrete(token: string, cep: string): Promise<Result<OpcaoDeFrete[], string>> {
      const { itens } = await deps.carrinhos.obterOuCriar(token);
      if (itens.length === 0) return err("Seu carrinho está vazio.");
      return cotar(itens, cep);
    },

    /**
     * Devolve o checkout abandonado ao estoque. Devolve quantos pedidos
     * foram cancelados.
     */
    async expirarVencidos(momento: Date = agora()): Promise<number> {
      let cancelados = 0;
      for (const ref of await deps.pedidos.vencidos(momento)) {
        // Só quem vence a troca de status libera: se o pagamento foi aprovado
        // no mesmo instante, a transição falha e o estoque fica com o pedido.
        const venceu = await deps.pedidos.transicionar(
          ref,
          "aguardando_pagamento",
          "cancelado",
          "Pagamento não concluído no prazo",
        );
        if (venceu) {
          await deps.estoque.liberarReserva(ref);
          cancelados++;
        }
      }
      // Reservas sem pedido (o processo caiu entre reservar e criar) também
      // precisam voltar.
      await deps.estoque.liberarVencidas(momento);
      return cancelados;
    },

    async finalizar(
      token: string,
      entrada: EntradaDoCheckout,
    ): Promise<Result<{ referencia: string; urlPagamento: string }, string>> {
      if (!deps.pagamento) {
        return err(`O pagamento online está indisponível no momento. ${FALE_CONOSCO}`);
      }

      const momento = agora();
      await servico.expirarVencidos(momento);

      const { itens } = await deps.carrinhos.obterOuCriar(token);
      if (itens.length === 0) return err("Seu carrinho está vazio.");

      const semEstoque = itens.find((i) => i.quantity > i.disponivel);
      if (semEstoque) {
        return err(`${nomeDoItem(semEstoque)} não tem a quantidade pedida. Ajuste o carrinho para continuar.`);
      }

      let recebimento: Recebimento = { tipo: "retirada" };
      if (entrada.recebimento.tipo === "entrega") {
        const { endereco, servicoId } = entrada.recebimento;
        const cotacao = await cotar(itens, endereco.cep);
        if (!cotacao.ok) return cotacao;
        const opcao = cotacao.value.find((o) => o.id === servicoId);
        if (!opcao) {
          return err("A opção de frete escolhida não está mais disponível. Calcule o frete de novo.");
        }
        recebimento = {
          tipo: "entrega",
          endereco,
          frete: {
            servicoId: opcao.id,
            servico: opcao.servico,
            transportadora: opcao.transportadora,
            prazoDias: opcao.prazoDias,
            precoCents: opcao.precoCents,
          },
        };
      }

      const referencia = gerarReferencia();
      const accessToken = gerarTokenDeAcesso();
      const expiresAt = new Date(momento.getTime() + VALIDADE_DA_RESERVA_MIN * MINUTO);

      const reserva = await deps.estoque.reservar({
        orderRef: referencia,
        itens: itens.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        expiresAt,
      });
      if (!reserva.ok) return err(mensagemDeEstoque(reserva.error, itens));

      const itemsTotalCents = itens.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
      const shippingCents = recebimento.tipo === "entrega" ? recebimento.frete.precoCents : 0;

      try {
        await deps.pedidos.criar({
          reference: referencia,
          accessToken,
          comprador: entrada.comprador,
          recebimento,
          itens: itens.map((i) => ({
            variantId: i.variantId,
            sku: i.sku,
            productName: i.productName,
            sizeLabel: i.sizeLabel,
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
          })),
          itemsTotalCents,
          shippingCents,
          totalCents: itemsTotalCents + shippingCents,
          cartToken: token,
          expiresAt,
        });
      } catch (e) {
        await deps.estoque.liberarReserva(referencia);
        throw e;
      }

      const cobranca = await deps.pagamento.criarCobranca({
        orderRef: referencia,
        itens: itens.map((i) => ({
          sku: i.sku,
          titulo: nomeDoItem(i),
          quantidade: i.quantity,
          precoUnitarioCents: i.unitPriceCents,
        })),
        freteCents: shippingCents,
        comprador: entrada.comprador,
        expiraEm: new Date(momento.getTime() + VALIDADE_DA_COBRANCA_MIN * MINUTO),
        urlRetorno: deps.urls.retorno(referencia, accessToken),
        urlNotificacao: deps.urls.notificacao,
      });

      if (!cobranca.ok) {
        await deps.pedidos.transicionar(
          referencia,
          "aguardando_pagamento",
          "cancelado",
          `Cobrança não criada: ${cobranca.error}`,
        );
        await deps.estoque.liberarReserva(referencia);
        return err(`Não foi possível iniciar o pagamento. ${FALE_CONOSCO}`);
      }

      await deps.pedidos.definirUrlDePagamento(referencia, cobranca.value.urlPagamento);
      return ok({ referencia, urlPagamento: cobranca.value.urlPagamento });
    },
  };

  return servico;
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
