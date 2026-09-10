import type { MetadataRoute } from "next";
import { getCatalogService } from "@/lib/container";

// Mesmo motivo da home: produto novo precisa entrar no sitemap sem rebuild.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { items } = await getCatalogService().listar({ page: 1, perPage: 96 });

  return [
    { url: base, priority: 1 },
    { url: `${base}/pneus`, priority: 0.9 },
    ...items.map((p) => ({
      url: `${base}/produto/${p.slug}`,
      priority: 0.8,
    })),
  ];
}
