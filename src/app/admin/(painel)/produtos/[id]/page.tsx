import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/sessao-admin";
import { produtoParaEdicao } from "@/db/consultas-do-painel";
import { TIPOS_DE_VEICULO } from "@/core/catalog/cadastro";
import { classesDeCampo } from "@/components/ui/botao";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { FormularioDeAcao } from "@/components/painel/formulario-de-acao";
import { CamposDoProduto } from "@/components/painel/campos-do-produto";
import { Campo, rotuloDeCampo } from "@/components/painel/campo";
import {
  acaoAdicionarFoto,
  acaoAdicionarVariante,
  acaoAtualizarProduto,
  acaoAtualizarVariante,
  acaoFotoPrincipal,
  acaoRemoverFoto,
} from "../acoes";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "Editar produto" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reais(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function quilos(gramas: number) {
  return String(gramas / 1000).replace(".", ",");
}

export default async function EditarProdutoPage({ params, searchParams }: Props) {
  await exigirUsuario("produtos");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const dados = await produtoParaEdicao(id);
  if (!dados) notFound();
  const { produto, variantes, fotos, marcas, categorias } = dados;
  const novo = (await searchParams).novo === "1";

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/produtos" className="font-semibold text-tinta-media hover:text-tinta">← Produtos</Link>
      </p>
      <CabecalhoDaPagina
        titulo={`${produto.marca} ${produto.nome}`}
        apoio={
          produto.status === "active" ? (
            <Link href={`/produto/${produto.slug}`} className="underline-offset-2 hover:underline" target="_blank">
              Ver na loja ↗
            </Link>
          ) : (
            "Fora da loja enquanto não estiver “À venda”."
          )
        }
      />

      {novo && (
        <p role="status" className="mt-6 rounded-controle bg-green-100 px-4 py-3 text-sm font-semibold text-green-900">
          Produto criado. Agora adicione as medidas e as fotos.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Secao titulo={`Medidas e preços (${variantes.length})`}>
            {variantes.length === 0 ? (
              <p className="text-sm text-tinta-media">Nenhuma medida ainda. Adicione a primeira abaixo.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {variantes.map((v) => (
                  <li key={v.id} className="py-4 first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-bold text-tinta">
                        {v.medida ?? "Sem medida"}
                        <span className="numerais-tabulares ml-2 text-xs font-normal text-tinta-media">{v.sku}</span>
                      </p>
                      <Link
                        href={`/admin/estoque/${encodeURIComponent(v.sku)}`}
                        className={`numerais-tabulares text-xs font-bold hover:underline ${v.disponivel > 0 ? "text-tinta" : "text-marca"}`}
                      >
                        {v.disponivel > 0 ? `${v.disponivel} em estoque` : "sem estoque"} →
                      </Link>
                    </div>
                    <FormularioDeAcao
                      acao={acaoAtualizarVariante.bind(null, produto.id, v.id)}
                      rotulo="Salvar"
                      variante="sutil"
                      tamanho="pequeno"
                      classeDosCampos="mt-2 flex flex-wrap items-end gap-3"
                    >
                      <Campo
                        rotulo="Preço (R$)"
                        nome="preco"
                        id={`preco-${v.id}`}
                        defaultValue={reais(v.priceCents)}
                        inputMode="decimal"
                        required
                        className="w-32"
                      />
                      <Campo
                        rotulo="Peso (kg)"
                        nome="pesoKg"
                        id={`peso-${v.id}`}
                        defaultValue={quilos(v.weightGrams)}
                        inputMode="decimal"
                        required
                        className="w-28"
                      />
                      <label className="flex items-center gap-2 pb-3 text-sm font-semibold text-tinta">
                        <input type="checkbox" name="ativa" defaultChecked={v.status === "active"} className="h-4 w-4 accent-marca" />
                        À venda
                      </label>
                    </FormularioDeAcao>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao titulo="Adicionar medida">
            <FormularioDeAcao
              acao={acaoAdicionarVariante.bind(null, produto.id)}
              rotulo="Adicionar medida"
              limparAoConcluir
              classeDosCampos="grid gap-4 sm:grid-cols-2"
            >
              <Campo rotulo="Medida" nome="medida" placeholder="205/55 R16 91V" ajuda="Vazio para acessório." />
              <Campo rotulo="SKU" nome="sku" required maxLength={60} placeholder="APT-RA301-2055516" />
              <Campo rotulo="Preço (R$)" nome="preco" required inputMode="decimal" placeholder="324,38" />
              <Campo rotulo="Peso (kg)" nome="pesoKg" required inputMode="decimal" placeholder="8,8" ajuda="Usado na cotação do frete." />
              <Campo rotulo="EAN" nome="ean" inputMode="numeric" maxLength={14} />
              <div>
                <label htmlFor="campo-tipoVeiculo" className={rotuloDeCampo()}>Tipo de veículo</label>
                <select id="campo-tipoVeiculo" name="tipoVeiculo" defaultValue="passeio" className={classesDeCampo("mt-1.5 w-full")}>
                  <option value="">Não se aplica</option>
                  {TIPOS_DE_VEICULO.map((t) => (
                    <option key={t} value={t}>{t === "suv" ? "SUV" : t[0].toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </FormularioDeAcao>
          </Secao>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Secao titulo="Modelo">
            <FormularioDeAcao acao={acaoAtualizarProduto.bind(null, produto.id)} rotulo="Salvar produto">
              <CamposDoProduto valores={produto} marcas={marcas} categorias={categorias} />
            </FormularioDeAcao>
          </Secao>

          <Secao titulo="Fotos">
            {fotos.length === 0 ? (
              <p className="text-sm text-tinta-media">Sem foto. A loja mostra um espaço vazio no lugar.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {fotos.map((f, i) => (
                  <li key={f.id} className="rounded-controle border border-neutral-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.alt} className="aspect-square w-full object-contain" />
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-tinta-media">
                      {i === 0 ? "Principal" : `Foto ${i + 1}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3">
                      {i > 0 && (
                        <form action={acaoFotoPrincipal.bind(null, produto.id, f.id)}>
                          <button type="submit" className="text-xs font-bold text-tinta hover:text-marca">Tornar principal</button>
                        </form>
                      )}
                      <form action={acaoRemoverFoto.bind(null, produto.id, f.id)}>
                        <button type="submit" className="text-xs font-bold text-marca hover:underline">Remover</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <FormularioDeAcao
                acao={acaoAdicionarFoto.bind(null, produto.id)}
                rotulo="Adicionar foto"
                variante="sutil"
                tamanho="pequeno"
                limparAoConcluir
              >
                <Campo rotulo="Endereço da imagem" nome="url" type="url" required placeholder="https://…" />
                <Campo rotulo="Descrição da imagem" nome="alt" maxLength={200} ajuda="Para leitores de tela e Google." />
              </FormularioDeAcao>
            </div>
          </Secao>
        </div>
      </div>
    </>
  );
}
