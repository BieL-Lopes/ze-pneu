import Link from "next/link";
import type { ProductSummary } from "@/core/catalog/types";
import { formatBRL } from "@/lib/format";

export function ProductCard({ produto }: { produto: ProductSummary }) {
  return (
    <Link
      href={`/produto/${produto.slug}`}
      className="group flex flex-col rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 hover:shadow-sm"
    >
      <div className="mb-3 aspect-square overflow-hidden rounded bg-neutral-100">
        {produto.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produto.imageUrl}
            alt={produto.altText ?? produto.name}
            className="h-full w-full object-contain transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            Sem imagem
          </div>
        )}
      </div>

      <span className="text-xs uppercase tracking-wide text-neutral-500">
        {produto.brandName}
      </span>
      <h3 className="mt-1 font-medium text-neutral-900">{produto.name}</h3>

      {produto.sizes.length > 0 && (
        <p className="mt-1 text-sm text-neutral-600">
          {produto.sizes.slice(0, 3).join(" · ")}
          {produto.sizes.length > 3 && ` +${produto.sizes.length - 3}`}
        </p>
      )}

      <p className="mt-auto pt-3 text-lg font-semibold text-neutral-900">
        <span className="text-sm font-normal text-neutral-500">
          a partir de{" "}
        </span>
        {formatBRL(produto.fromPriceCents)}
      </p>
    </Link>
  );
}
