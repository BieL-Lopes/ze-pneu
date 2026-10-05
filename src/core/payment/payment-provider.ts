import type { Result } from "@/core/shared/result";

export type StatusDePagamento = "pendente" | "aprovado" | "recusado" | "estornado";

export type NovaCobranca = {
  orderRef: string;
  itens: {
    sku: string;
    titulo: string;
    quantidade: number;
    precoUnitarioCents: number;
  }[];
  freteCents: number;
  comprador: { nome: string; email: string; cpf: string; telefone: string };
  /** Depois disto o provedor não aceita mais pagamento. */
  expiraEm: Date;
  /** Para onde o provedor devolve o cliente, pague ou desista. */
  urlRetorno: string;
  /** Onde o provedor avisa mudança de status. */
  urlNotificacao: string;
};

export type Pagamento = {
  providerPaymentId: string;
  /** Referência do pedido devolvida pelo provedor. Null se não veio de nós. */
  orderRef: string | null;
  status: StatusDePagamento;
  metodo: string | null;
  valorCents: number;
};

/**
 * Porta de pagamento.
 *
 * O status é traduzido para o vocabulário da loja no adaptador: o fluxo de
 * confirmação decide sobre "aprovado" e "estornado", nunca sobre os nomes do
 * provedor.
 */
export interface PaymentProvider {
  readonly nome: string;
  criarCobranca(
    cobranca: NovaCobranca,
  ): Promise<Result<{ urlPagamento: string }, string>>;
  /** Null quando o provedor não conhece o id. */
  consultarPagamento(providerPaymentId: string): Promise<Pagamento | null>;
}
