export type MovementKind =
  | "entrada"
  | "reserva"
  | "liberacao"
  | "baixa"
  | "estorno"
  | "ajuste";

export type Disponibilidade = {
  variantId: string;
  onHand: number;
  reserved: number;
  /** onHand - reserved. É este número que o cliente pode comprar. */
  disponivel: number;
};

export type PedidoDeReserva = {
  variantId: string;
  quantity: number;
};

export type Movimento = {
  id: string;
  kind: MovementKind;
  quantity: number;
  reason: string | null;
  orderRef: string | null;
  authorId: string | null;
  createdAt: Date;
};

export type FalhaDeEstoque =
  | {
      tipo: "indisponivel";
      variantId: string;
      pedido: number;
      disponivel: number;
    }
  | { tipo: "sku_sem_estoque"; variantId: string }
  | { tipo: "reserva_inexistente"; orderRef: string };
