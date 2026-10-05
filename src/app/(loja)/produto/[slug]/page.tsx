import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogService } from "@/lib/container";
import { SeletorMedida } from "@/components/produto/seletor-medida";
import { SelecaoDeMedida } from "@/components/produto/selecao-de-medida";
import { EspecificacoesTecnicas } from "@/components/produto/especificacoes-tecnicas";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { IconeWhatsApp } from "@/components/icones";
import { classesDeBotao } from "@/components/ui/botao";

type Props = { params: Promise<{ slug: string }> };

/** A descrição é guardada com parágrafos separados por linha em branco. */
function paragrafos(texto: string | null): string[] {
  return (texto ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

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
    // Só o primeiro parágrafo: é o que cabe no resultado do Google.
    description:
      paragrafos(produto.description)[0] ??
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

  const texto = paragrafos(produto.description);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <SelecaoDeMedida variantes={produto.variants}>
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

            <div className="mt-10">
              <SeletorMedida />
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

        <div className="mt-16 grid gap-12 md:grid-cols-2">
          <section className="border-t-4 border-tinta pt-6">
            <h2 className="text-xl font-black uppercase italic tracking-tight text-tinta">
              Descrição
            </h2>
            <div className="mt-4 max-w-[65ch] space-y-4 leading-relaxed text-tinta-media">
              {texto.length > 0 ? (
                texto.map((p) => <p key={p}>{p}</p>)
              ) : (
                <p>
                  {produto.brandName} {produto.name}. Fale com a gente no
                  WhatsApp para tirar dúvidas sobre a medida certa para o seu
                  carro.
                </p>
              )}
              <p className="text-xs">*Imagem meramente ilustrativa.</p>
            </div>
          </section>

          <section className="border-t-4 border-tinta pt-6">
            <h2 className="text-xl font-black uppercase italic tracking-tight text-tinta">
              Especificações técnicas
            </h2>
            <div className="mt-4">
              <EspecificacoesTecnicas marca={produto.brandName} desenho={produto.name} />
            </div>
          </section>
        </div>
      </SelecaoDeMedida>
    </main>
  );
}
