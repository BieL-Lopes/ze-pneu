import { type Result, ok, err } from "@/core/shared/result";
import { parseTireSize, type TireSize } from "./tire-size";
import { precoParaCentavos } from "./csv-import";

/**
 * Validação do cadastro manual pelo painel.
 *
 * Mesmas regras da importação por planilha — preço em reais brasileiros,
 * medida no formato da lateral do pneu, peso obrigatório para o frete — para
 * que um produto não passe por um caminho e seja recusado pelo outro.
 */

export const STATUS_DE_PRODUTO = ["draft", "active", "archived"] as const;
export type StatusDeProduto = (typeof STATUS_DE_PRODUTO)[number];

export const ROTULO_STATUS_PRODUTO: Record<StatusDeProduto, string> = {
  draft: "Rascunho",
  active: "À venda",
  archived: "Arquivado",
};

export const TIPOS_DE_VEICULO = ["passeio", "suv", "carga", "moto"] as const;
export type TipoDeVeiculo = (typeof TIPOS_DE_VEICULO)[number];

export type ProdutoValido = {
  nome: string;
  descricao: string | null;
  status: StatusDeProduto;
  marca: string;
  categoria: string;
};

export function validarProduto(entrada: {
  nome: string;
  descricao: string;
  status: string;
  marca: string;
  categoria: string;
}): Result<ProdutoValido> {
  const nome = entrada.nome.trim();
  if (nome.length < 2) return err("Informe o nome do produto.");
  if (nome.length > 120) return err("Nome longo demais.");
  const marca = entrada.marca.trim();
  if (!marca) return err("Informe a marca.");
  const categoria = entrada.categoria.trim();
  if (!categoria) return err("Informe a categoria.");
  if (!(STATUS_DE_PRODUTO as readonly string[]).includes(entrada.status)) return err("Status inválido.");
  const descricao = entrada.descricao.trim();
  if (descricao.length > 5000) return err("Descrição longa demais.");

  return ok({
    nome,
    descricao: descricao || null,
    status: entrada.status as StatusDeProduto,
    marca: marca.slice(0, 80),
    categoria: categoria.slice(0, 80),
  });
}

export type VarianteValida = {
  sku: string;
  ean: string | null;
  precoCents: number;
  medida: TireSize | null;
  tipoVeiculo: TipoDeVeiculo | null;
  pesoGramas: number;
};

export function validarVariante(entrada: {
  sku: string;
  ean: string;
  preco: string;
  medida: string;
  tipoVeiculo: string;
  pesoKg: string;
}): Result<VarianteValida> {
  const sku = entrada.sku.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{1,59}$/.test(sku)) {
    return err("SKU inválido: use letras, números, ponto, hífen ou sublinhado.");
  }

  const ean = entrada.ean.replace(/\D/g, "");
  if (ean && ![8, 12, 13, 14].includes(ean.length)) return err("EAN inválido.");

  const precoCents = precoParaCentavos(entrada.preco);
  if (precoCents === null || precoCents <= 0) return err("Preço inválido.");

  let medida: TireSize | null = null;
  if (entrada.medida.trim()) {
    const r = parseTireSize(entrada.medida);
    if (!r.ok) return r;
    medida = r.value;
  }

  const tipo = entrada.tipoVeiculo.trim();
  if (tipo && !(TIPOS_DE_VEICULO as readonly string[]).includes(tipo)) return err("Tipo de veículo inválido.");

  const kg = Number(entrada.pesoKg.trim().replace(",", "."));
  if (!Number.isFinite(kg) || kg <= 0 || kg > 500) {
    return err("Peso inválido. Ele é necessário para cotar o frete.");
  }

  return ok({
    sku,
    ean: ean || null,
    precoCents,
    medida,
    tipoVeiculo: (tipo || null) as TipoDeVeiculo | null,
    pesoGramas: Math.round(kg * 1000),
  });
}

/** Só aceita endereço https: imagem em http quebra a página segura da loja. */
export function validarUrlDeFoto(bruto: string): Result<string> {
  const texto = bruto.trim();
  try {
    const url = new URL(texto);
    if (url.protocol !== "https:") return err("A foto precisa de um endereço https://.");
    return ok(url.toString());
  } catch {
    return err("Endereço da foto inválido.");
  }
}
