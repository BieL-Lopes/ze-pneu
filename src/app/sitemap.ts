import type { MetadataRoute } from "next";
import { getCatalogService } from "@/lib/container";
import { siteUrl } from "@/lib/site-url";

// Mesmo motivo da home: produto novo precisa entrar no sitemap sem rebuild.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { items } = await getCatalogService().listar({ page: 1, perPage: 96 });

  // new URL(caminho, base) em vez de concatenar string: o Google rejeita
  // sitemap com URL relativa, e concatenação produz barra dupla quando a base
  // termina em "/".
  return [
    { url: new URL("/", base).toString(), priority: 1 },
    { url: new URL("/pneus", base).toString(), priority: 0.9 },
    ...items.map((p) => ({
      url: new URL(`/produto/${p.slug}`, base).toString(),
      priority: 0.8,
    })),
  ];
}
