import Link from "next/link";
import Image from "next/image";
import { getCatalogService, getConfiguracoes } from "@/lib/container";
import { ProductCard } from "@/components/produto/product-card";
import { FaixaPromocional } from "@/components/home/faixa-promocional";
import { BuscaPorMedida } from "@/components/home/busca-por-medida";
import { AtalhosAro } from "@/components/home/atalhos-aro";
import { Marcas } from "@/components/home/marcas";
import { Motivos } from "@/components/home/motivos";
import { ChamadaServicos } from "@/components/home/chamada-servicos";
import { BotaoLink } from "@/components/ui/botao";
import logoZePneu from "@/assets/logo-ze-pneu.png";

// O catálogo muda por importação de CSV, não por deploy. Sem isto a home
// ficaria congelada no conteúdo do último build, escondendo produto novo.
export const revalidate = 300;

export default async function HomePage() {
  const [{ items, facets }, config] = await Promise.all([
    getCatalogService().listar({ page: 1, perPage: 8 }),
    getConfiguracoes(["banner_texto", "banner_link"]),
  ]);

  return (
    <main>
      <FaixaPromocional
        texto={config.banner_texto ?? null}
        link={config.banner_link ?? null}
      />

      {/*
        Campo vermelho da marca. Sobre ele, só branco puro atinge 4,5:1 de
        contraste — a hierarquia vem de peso e tamanho, e o CTA é preto,
        que é a relação preto-sobre-vermelho do próprio logo.
      */}
      <section className="bg-marca">
        <div className="mx-auto flex max-w-7xl flex-col-reverse items-center gap-10 px-4 py-16 sm:py-20 lg:flex-row lg:justify-between lg:gap-16">
          <div className="w-full lg:flex-1">
            <h1 className="max-w-2xl text-balance text-4xl font-black uppercase italic leading-[1.04] tracking-tight text-white sm:text-6xl sm:leading-[0.98]">
              O pneu certo, sem complicação
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium text-white">
              Busque pela medida do seu pneu, compare marcas e receba em casa —
              ou retire em Brasília.
            </p>
            <BotaoLink href="/pneus" variante="escura" tamanho="grande" className="mt-10">
              Ver todos os pneus
            </BotaoLink>
          </div>

          {/*
            priority porque o logo está acima da dobra: sem isso ele entra
            depois do restante e o hero pisca vazio na primeira visita.
          */}
          <Image
            src={logoZePneu}
            alt="Zé Pneu"
            priority
            sizes="(max-width: 1024px) 200px, 340px"
            className="h-auto w-[200px] shrink-0 sm:w-[260px] lg:w-[340px]"
          />
        </div>
      </section>

      {/*
        A busca por medida fica logo abaixo do hero: é a primeira coisa que a
        pessoa faz ao chegar, e ela lê os três números na lateral do próprio
        pneu.
      */}
      <section className="bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="text-2xl font-black uppercase italic tracking-tight text-tinta">
            Qual a medida do seu pneu?
          </h2>
          <p className="mt-2 text-tinta-media">
            Os três números estão na lateral do pneu, assim:{" "}
            <span className="numerais-tabulares font-bold text-tinta">
              205/55 R16
            </span>
          </p>

          <div className="mt-8">
            <BuscaPorMedida />
          </div>

          <div className="mt-10 border-t border-neutral-200 pt-8">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-tinta-media">
              Ou vá direto pelo aro
            </p>
            <AtalhosAro />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {items.length > 0 && (
          <section className="py-16">
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

        <Marcas marcas={facets.brands} />
      </div>

      <Motivos />

      <div className="mx-auto max-w-7xl px-4">
        <ChamadaServicos />
      </div>
    </main>
  );
}
