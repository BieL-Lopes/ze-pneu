import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/sessao-admin";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { FormularioDeImportacao } from "@/components/painel/formulario-de-importacao";
import { acaoImportarPlanilha } from "../acoes";

export const metadata: Metadata = { title: "Importar planilha" };

const COLUNAS = [
  ["marca", "Aptany"],
  ["categoria", "Pneus"],
  ["produto", "RA301"],
  ["descricao", "opcional"],
  ["sku", "APT-RA301-2055516"],
  ["ean", "opcional"],
  ["preco", "324,38"],
  ["medida", "205/55 R16 91V"],
  ["tipo_veiculo", "passeio, suv, carga ou moto"],
  ["peso_gramas", "8800"],
  ["imagem_url", "opcional, https://…"],
];

export default async function ImportarPage() {
  await exigirUsuario("produtos");

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/produtos" className="font-semibold text-tinta-media hover:text-tinta">← Produtos</Link>
      </p>
      <CabecalhoDaPagina
        titulo="Importar planilha"
        apoio="Para cadastrar muitas medidas de uma vez ou reajustar a tabela de preços."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Secao titulo="Enviar arquivo">
          <FormularioDeImportacao acao={acaoImportarPlanilha} />
        </Secao>

        <Secao titulo="Como montar a planilha">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-tinta">
            <li>Exporte como <strong>CSV separado por vírgula</strong>, uma linha por medida.</li>
            <li>SKU que já existe tem <strong>preço e peso atualizados</strong>; os demais campos ficam como estão.</li>
            <li>Produto novo entra <strong>à venda</strong>, mas só aparece na loja depois de lançar estoque.</li>
            <li>Linha com erro é pulada e listada aqui com o número dela; as outras entram.</li>
          </ul>
          <table className="mt-4 w-full text-sm">
            <caption className="mb-2 text-left text-xs font-bold uppercase tracking-widest text-tinta-media">
              Colunas obrigatórias no cabeçalho
            </caption>
            <tbody className="divide-y divide-neutral-100">
              {COLUNAS.map(([coluna, exemplo]) => (
                <tr key={coluna}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-mono text-xs font-bold text-tinta">{coluna}</th>
                  <td className="py-1.5 text-tinta-media">{exemplo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
      </div>
    </>
  );
}
