import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogService } from "@/lib/container";
import { SeletorMedida } from "@/components/produto/seletor-medida";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { IconeWhatsApp } from "@/components/icones";
import { classesDeBotao } from "@/components/ui/botao";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const produto = await getCatalogService().detalhe(slug);
  if (!produto) return { title: "Produto não encontrado" };

  const medidas = produto.variants
    .map((v) => v.sizeLabel)
    .filter(Boolean)
    .join(", ");

  return {
    title: `${produto.brandName} ${produto.name}`,
    description:
      produto.description ??
      `${produto.brandName} ${produto.name}${
        medidas ? ` nas medidas ${medidas}` : ""
      }. Entrega em todo o Brasil e retirada em Brasília.`,
  };
}

export default async function ProdutoPage({ params }: Props) {
  const { slug } = await params;
  const produto = await getCatalogService().detalhe(slug);
  if (!produto) notFound();

  const capa = produto.media[0];

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-12 md:grid-cols-2">
        <div className="aspect-square overflow-hidden bg-neutral-100">
          {capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capa.url}
              alt={capa.alt}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-tinta-media">
              Sem imagem
            </div>
          )}
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-marca">
            {produto.brandName}
          </span>
          <h1 className="mt-2 text-4xl font-black uppercase italic leading-none tracking-tight text-tinta">
            {produto.name}
          </h1>

          {produto.description && (
            <p className="mt-5 text-tinta-media">{produto.description}</p>
          )}

          <div className="mt-10">
            <SeletorMedida variantes={produto.variants} />
          </div>

          <WhatsAppLink
            mensagem={`Olá! Tenho uma dúvida sobre o ${produto.brandName} ${produto.name}.`}
            className={classesDeBotao({ variante: "contorno", tamanho: "grande", larguraTotal: true, extra: "mt-3" })}
          >
            <IconeWhatsApp className="h-5 w-5" />
            Tirar dúvida no WhatsApp
          </WhatsAppLink>
        </div>
      </div>
    </main>
  );
}
