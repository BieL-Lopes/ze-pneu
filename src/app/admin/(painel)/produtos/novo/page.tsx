import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/sessao-admin";
import { marcasECategorias } from "@/db/consultas-do-painel";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { FormularioDeAcao } from "@/components/painel/formulario-de-acao";
import { CamposDoProduto } from "@/components/painel/campos-do-produto";
import { acaoCriarProduto } from "../acoes";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  await exigirUsuario("produtos");
  const { marcas, categorias } = await marcasECategorias();

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/produtos" className="font-semibold text-tinta-media hover:text-tinta">← Produtos</Link>
      </p>
      <CabecalhoDaPagina
        titulo="Novo produto"
        apoio="Primeiro o modelo; na tela seguinte você adiciona as medidas, os preços e as fotos."
      />
      <Secao titulo="Modelo" className="mt-6 max-w-2xl">
        <FormularioDeAcao acao={acaoCriarProduto} rotulo="Criar e continuar">
          <CamposDoProduto marcas={marcas} categorias={categorias} />
        </FormularioDeAcao>
      </Secao>
    </>
  );
}
