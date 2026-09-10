import Link from "next/link";
import { getCatalogService } from "@/lib/container";
import { ProductCard } from "@/components/produto/product-card";

// O catálogo muda por importação de CSV, não por deploy. Sem isto a home
// ficaria congelada no conteúdo do último build, escondendo produto novo.
export const revalidate = 300;

export default async function HomePage() {
  const { items } = await getCatalogService().listar({ page: 1, perPage: 8 });

  return (
    <main>
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-neutral-900 sm:text-5xl">
            O pneu certo, sem complicação
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600">
            Busque pela medida do seu pneu, compare marcas e receba em casa — ou
            retire em Brasília.
          </p>
          <Link
            href="/pneus"
            className="mt-8 inline-block rounded-lg bg-neutral-900 px-8 py-3 font-semibold text-white hover:bg-neutral-700"
          >
            Ver todos os pneus
          </Link>
        </div>
      </section>

      {items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="text-2xl font-bold text-neutral-900">Destaques</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((produto) => (
              <ProductCard key={produto.id} produto={produto} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
