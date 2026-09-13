import type { Result } from "@/core/shared/result";
import type {
  Disponibilidade,
  FalhaDeEstoque,
  Movimento,
  PedidoDeReserva,
} from "./types";

/**
 * Porta do livro-razão de estoque.
 *
 * `reservar` recebe a lista inteira do carrinho de propósito: ou o pedido
 * inteiro é reservado, ou nada é. Reservar item a item deixaria o cliente com
 * meio pedido quando o último item faltasse.
 *
 * A reserva é identificada pela referência do pedido ("ZP-XXXXXXXX") e não por
 * uuid, porque ela nasce antes do pedido existir.
 */
export interface StockRepository {
  disponibilidadeDe(variantIds: string[]): Promise<Disponibilidade[]>;

  registrarEntrada(args: {
    variantId: string;
    quantity: number;
    reason: string;
    authorId: string;
  }): Promise<void>;

  reservar(args: {
    orderRef: string;
    itens: PedidoDeReserva[];
    expiresAt: Date;
  }): Promise<Result<void, FalhaDeEstoque>>;

  liberarReserva(orderRef: string): Promise<void>;

  consumirReserva(orderRef: string): Promise<Result<void, FalhaDeEstoque>>;

  ajustar(args: {
    variantId: string;
    delta: number;
    reason: string;
    authorId: string;
  }): Promise<void>;

  extrato(variantId: string): Promise<Movimento[]>;

  /** Libera reservas vencidas. Devolve quantos pedidos foram liberados. */
  liberarVencidas(agora: Date): Promise<number>;
}
