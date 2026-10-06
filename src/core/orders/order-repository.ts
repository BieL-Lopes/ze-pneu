import type { Pagamento } from "@/core/payment/payment-provider";
import type { OrderStatus } from "./order-status";

export type EnderecoDeEntrega = {
  cep: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

export type FreteEscolhido = {
  servicoId: string;
  servico: string;
  transportadora: string;
  prazoDias: number;
  precoCents: number;
};

export type Comprador = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
};

export type ItemDoPedido = {
  variantId: string;
  sku: string;
  productName: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
};

export type Recebimento =
  | { tipo: "retirada" }
  | { tipo: "entrega"; endereco: EnderecoDeEntrega; frete: FreteEscolhido };

export type NovoPedido = {
  reference: string;
  accessToken: string;
  comprador: Comprador;
  recebimento: Recebimento;
  itens: ItemDoPedido[];
  itemsTotalCents: number;
  shippingCents: number;
  totalCents: number;
  cartToken: string;
  expiresAt: Date;
};

export type NotaFiscal = { numero: string; chave: string | null };

export type Pedido = NovoPedido & {
  id: string;
  status: OrderStatus;
  paymentUrl: string | null;
  /** Código de rastreio da transportadora, lançado pela operação ao despachar. */
  rastreio: string | null;
  /** Lançada à mão enquanto não há emissor de NF-e integrado. */
  notaFiscal: NotaFiscal | null;
  createdAt: Date;
};

export type EventoDoPedido = {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  /** Quem fez a mudança no painel. Null para o que o sistema fez sozinho. */
  autor?: string | null;
  createdAt: Date;
};

/**
 * Porta de persistência do pedido.
 *
 * `transicionar` é condicional de propósito: só troca se o status atual for o
 * esperado, numa única instrução. Duas notificações simultâneas do mesmo
 * pagamento chegam aqui ao mesmo tempo; só uma recebe `true` e segue para
 * baixar o estoque.
 */
export interface OrderRepository {
  criar(pedido: NovoPedido): Promise<Pedido>;
  porReferencia(reference: string): Promise<Pedido | null>;
  eventos(reference: string): Promise<EventoDoPedido[]>;
  definirUrlDePagamento(reference: string, url: string): Promise<void>;
  transicionar(
    reference: string,
    de: OrderStatus,
    para: OrderStatus,
    nota: string,
    autor?: string,
  ): Promise<boolean>;
  /** Anotação no histórico sem mudar o status. */
  anotar(reference: string, nota: string, autor?: string): Promise<void>;
  definirRastreio(reference: string, codigo: string | null): Promise<void>;
  definirNotaFiscal(reference: string, nota: NotaFiscal | null): Promise<void>;
  registrarPagamento(
    reference: string,
    provedor: string,
    pagamento: Pagamento,
  ): Promise<void>;
  /** Referências aguardando pagamento cujo prazo já passou. */
  vencidos(agora: Date): Promise<string[]>;
}
