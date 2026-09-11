import type { CatalogFilters } from "./types";

type Params = Record<string, string | string[] | undefined>;

const PER_PAGE_PADRAO = 24;
const PER_PAGE_MAXIMO = 96;

function lista(valor: string | string[] | undefined): string[] {
  if (valor === undefined) return [];
  const bruto = Array.isArray(valor) ? valor : valor.split(",");
  return bruto.map((v) => v.trim()).filter((v) => v !== "");
}

function numeros(valor: string | string[] | undefined): number[] {
  return lista(valor)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

function inteiroPositivo(
  valor: string | string[] | undefined,
  padrao: number,
): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n > 0 ? n : padrao;
}

function reaisParaCentavos(
  valor: string | string[] | undefined,
): number | undefined {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  if (bruto === undefined || bruto.trim() === "") return undefined;
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

function texto(valor: string | string[] | undefined): string | undefined {
  const v = (Array.isArray(valor) ? valor[0] : valor)?.trim();
  return v ? v : undefined;
}

function vazioParaIndefinido<T>(arr: T[]): T[] | undefined {
  return arr.length ? arr : undefined;
}

/**
 * Traduz os parâmetros da URL para o filtro do domínio.
 *
 * Os filtros vivem na URL de propósito: é o que deixa o cliente compartilhar o
 * link e o Google indexar cada combinação de medida. Entrada inválida é
 * descartada em silêncio — uma URL adulterada não deve derrubar a listagem.
 */
export function parseFilters(params: Params): CatalogFilters {
  return {
    query: texto(params.q),
    brandSlugs: vazioParaIndefinido(lista(params.marca)),
    widths: vazioParaIndefinido(numeros(params.largura)),
    profiles: vazioParaIndefinido(numeros(params.perfil)),
    rims: vazioParaIndefinido(numeros(params.aro)),
    vehicleTypes: vazioParaIndefinido(lista(params.tipo)),
    minPriceCents: reaisParaCentavos(params.preco_min),
    maxPriceCents: reaisParaCentavos(params.preco_max),
    page: inteiroPositivo(params.pagina, 1),
    perPage: Math.min(
      inteiroPositivo(params.por_pagina, PER_PAGE_PADRAO),
      PER_PAGE_MAXIMO,
    ),
  };
}

export function filtersToSearchParams(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.query) p.set("q", f.query);
  if (f.brandSlugs?.length) p.set("marca", f.brandSlugs.join(","));
  if (f.widths?.length) p.set("largura", f.widths.join(","));
  if (f.profiles?.length) p.set("perfil", f.profiles.join(","));
  if (f.rims?.length) p.set("aro", f.rims.join(","));
  if (f.vehicleTypes?.length) p.set("tipo", f.vehicleTypes.join(","));
  if (f.minPriceCents !== undefined)
    p.set("preco_min", String(f.minPriceCents / 100));
  if (f.maxPriceCents !== undefined)
    p.set("preco_max", String(f.maxPriceCents / 100));
  if (f.page !== 1) p.set("pagina", String(f.page));
  if (f.perPage !== PER_PAGE_PADRAO) p.set("por_pagina", String(f.perPage));
  return p;
}
