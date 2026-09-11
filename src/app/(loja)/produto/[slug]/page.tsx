import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogService } from "@/lib/container";
import { SeletorMedida } from "@/components/produto/seletor-medida";
import { WhatsAppLink } from "@/components/whatsapp-link";

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
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-lg bg-neutral-100">
          {capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capa.url}
              alt={capa.alt}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-400">
              Sem imagem
            </div>
          )}
        </div>

        <div>
          <span className="text-sm uppercase tracking-wide text-neutral-500">
            {produto.brandName}
          </span>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">
            {produto.name}
          </h1>

          {produto.description && (
            <p className="mt-4 text-neutral-600">{produto.description}</p>
          )}

          <div className="mt-8">
            <SeletorMedida variantes={produto.variants} />
          </div>

          <WhatsAppLink
            mensagem={`Olá! Tenho uma dúvida sobre o ${produto.brandName} ${produto.name}.`}
            className="mt-4 block w-full rounded-lg border border-neutral-300 px-6 py-3 text-center font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Tirar dúvida no WhatsApp
          </WhatsAppLink>
        </div>
      </div>
    </main>
  );
}
