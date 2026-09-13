import Link from "next/link";
import type { ProductSummary } from "@/core/catalog/types";
import { formatBRL } from "@/lib/format";

export function ProductCard({ produto }: { produto: ProductSummary }) {
  return (
    <Link
      href={`/produto/${produto.slug}`}
      className="group flex flex-col rounded-controle border border-neutral-200 bg-white p-4 transition hover:border-marca"
    >
      <div className="mb-4 aspect-square overflow-hidden rounded-controle bg-neutral-100">
        {produto.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produto.imageUrl}
            alt={produto.altText ?? produto.name}
            className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-tinta-media">
            Sem imagem
          </div>
        )}
      </div>

      <span className="text-xs font-bold uppercase tracking-widest text-marca">
        {produto.brandName}
      </span>
      <h3 className="mt-1 font-bold text-tinta">{produto.name}</h3>

      {produto.sizes.length > 0 && (
        <p className="numerais-tabulares mt-1 text-sm text-tinta-media">
          {produto.sizes.slice(0, 3).join(" · ")}
          {produto.sizes.length > 3 && ` +${produto.sizes.length - 3}`}
        </p>
      )}

      <p className="numerais-tabulares mt-auto pt-4 text-xl font-black text-tinta">
        <span className="block text-xs font-medium uppercase tracking-wide text-tinta-media">
          a partir de
        </span>
        {formatBRL(produto.fromPriceCents)}
      </p>
    </Link>
  );
}
