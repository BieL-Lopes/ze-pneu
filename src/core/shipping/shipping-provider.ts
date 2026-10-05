import type { Result } from "@/core/shared/result";

/** Um SKU do carrinho como a transportadora o enxerga. */
export type Pacote = {
  sku: string;
  quantidade: number;
  pesoGramas: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  /** Valor unitário, para o seguro da carga. */
  valorCents: number;
};

export type OpcaoDeFrete = {
  /** Id do serviço no provedor. É por ele que o checkout reencontra a opção. */
  id: string;
  servico: string;
  transportadora: string;
  prazoDias: number;
  precoCents: number;
};

/**
 * Porta de frete.
 *
 * Nenhum arquivo de checkout conhece o Melhor Envio: trocar de provedor é
 * escrever outro adaptador. A retirada em Brasília não passa por aqui — não é
 * cotação, é uma opção fixa da loja.
 */
export interface ShippingProvider {
  cotar(args: {
    cepDestino: string;
    pacotes: Pacote[];
  }): Promise<Result<OpcaoDeFrete[], string>>;
}
