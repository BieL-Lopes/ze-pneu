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
  /** Peso e caixa de uma unidade, para cotar o frete. */
  envio: DadosDeEnvio;
};

export type DadosDeEnvio = {
  pesoGramas: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
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
