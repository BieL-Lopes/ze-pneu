export type CartItem = {
  variantId: string;
  sku: string;
  productName: string;
  productSlug: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  /** Estoque disponível agora, para avisar antes de o cliente ir ao checkout. */
  disponivel: number;
};

export type Cart = {
  id: string;
  token: string;
  itens: CartItem[];
};

export type CartTotals = {
  itemsTotalCents: number;
  quantidadeTotal: number;
  temItemIndisponivel: boolean;
};
