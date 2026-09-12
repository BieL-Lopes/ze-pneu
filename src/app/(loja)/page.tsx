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
      {/*
        Campo vermelho da marca. Sobre ele, só branco puro atinge 4,5:1 de
        contraste — a hierarquia vem de peso e tamanho, e o CTA é preto,
        que é a relação preto-sobre-vermelho do próprio logo.
      */}
      <section className="bg-marca">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <h1 className="max-w-3xl text-balance text-4xl font-black uppercase italic leading-[1.04] tracking-tight text-white sm:text-6xl sm:leading-[0.98] lg:text-7xl">
            O pneu certo, sem complicação
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium text-white">
            Busque pela medida do seu pneu, compare marcas e receba em casa — ou
            retire em Brasília.
          </p>
          <Link
            href="/pneus"
            className="mt-10 inline-block rounded-md bg-tinta px-8 py-4 text-base font-bold uppercase tracking-wide text-white transition hover:bg-black"
          >
            Ver todos os pneus
          </Link>
        </div>
      </section>

      {items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-3xl font-black uppercase italic tracking-tight text-tinta">
              Destaques
            </h2>
            <Link
              href="/pneus"
              className="shrink-0 text-sm font-bold text-marca transition hover:text-marca-escura"
            >
              Ver todos
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((produto) => (
              <ProductCard key={produto.id} produto={produto} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
