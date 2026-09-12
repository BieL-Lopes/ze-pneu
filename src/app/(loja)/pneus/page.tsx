import type { Metadata } from "next";
import { parseFilters, filtersToSearchParams } from "@/core/catalog/filters";
import { getCatalogService } from "@/lib/container";
import { ProductCard } from "@/components/produto/product-card";
import { FiltroFacetas } from "@/components/catalogo/filtro-facetas";
import { Paginacao } from "@/components/catalogo/paginacao";
import { PainelFiltros } from "@/components/catalogo/painel-filtros";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Pneus",
  description:
    "Pneus de todas as medidas e marcas, com entrega em todo o Brasil e retirada em Brasília.",
};

export default async function PneusPage({ searchParams }: Props) {
  const params = await searchParams;
  const filtros = parseFilters(params);
  const { items, total, facets } = await getCatalogService().listar(filtros);
  const atuais = filtersToSearchParams(filtros);

  // Quantos grupos de faceta o cliente já escolheu, para o botão de filtro no
  // celular mostrar que há filtro ativo mesmo com o painel fechado.
  const filtrosAtivos = [
    filtros.brandSlugs,
    filtros.widths,
    filtros.profiles,
    filtros.rims,
    filtros.vehicleTypes,
  ].filter((f) => f && f.length > 0).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-4xl font-black uppercase italic tracking-tight text-tinta">
        Pneus
      </h1>
      <p className="numerais-tabulares mt-2 text-sm font-medium uppercase tracking-wide text-tinta-media">
        {total === 0
          ? "Nenhum produto encontrado"
          : `${total} ${total === 1 ? "produto" : "produtos"}`}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside>
          <PainelFiltros filtrosAtivos={filtrosAtivos}>
            <FiltroFacetas
              titulo="Marca"
              chave="marca"
              opcoes={facets.brands}
              selecionados={filtros.brandSlugs ?? []}
              paramsAtuais={atuais}
            />
            <FiltroFacetas
              titulo="Largura"
              chave="largura"
              opcoes={facets.widths}
              selecionados={(filtros.widths ?? []).map(String)}
              paramsAtuais={atuais}
            />
            <FiltroFacetas
              titulo="Perfil"
              chave="perfil"
              opcoes={facets.profiles}
              selecionados={(filtros.profiles ?? []).map(String)}
              paramsAtuais={atuais}
            />
            <FiltroFacetas
              titulo="Aro"
              chave="aro"
              opcoes={facets.rims}
              selecionados={(filtros.rims ?? []).map(String)}
              paramsAtuais={atuais}
            />
            <FiltroFacetas
              titulo="Tipo de veículo"
              chave="tipo"
              opcoes={facets.vehicleTypes}
              selecionados={filtros.vehicleTypes ?? []}
              paramsAtuais={atuais}
            />
          </PainelFiltros>
        </aside>

        <section>
          {items.length === 0 ? (
            <p className="border border-dashed border-neutral-300 p-16 text-center text-tinta-media">
              Não encontramos pneus com esses filtros. Tente remover algum ou
              buscar pela medida, como 205/55 R16.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((produto) => (
                <ProductCard key={produto.id} produto={produto} />
              ))}
            </div>
          )}

          <Paginacao
            page={filtros.page}
            perPage={filtros.perPage}
            total={total}
            paramsAtuais={atuais}
          />
        </section>
      </div>
    </main>
  );
}
