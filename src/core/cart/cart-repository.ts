import type { Cart } from "./types";

export interface CartRepository {
  obterOuCriar(token: string): Promise<Cart>;
  /** Define a quantidade absoluta do SKU. Zero remove o item. */
  definirItem(token: string, variantId: string, quantity: number): Promise<Cart>;
  remover(token: string, variantId: string): Promise<Cart>;
  limpar(token: string): Promise<void>;
}
