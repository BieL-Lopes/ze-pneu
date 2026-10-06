import type { Metadata } from "next";
import { exigirUsuario } from "@/lib/sessao-admin";
import { lerConfiguracoesDoPainel } from "@/db/consultas-do-painel";
import { getShippingProvider } from "@/lib/container";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { FormularioDeAcao } from "@/components/painel/formulario-de-acao";
import { Campo } from "@/components/painel/campo";
import { acaoSalvarFaixa, acaoSalvarFrete, acaoSalvarRetirada } from "./acoes";

export const metadata: Metadata = { title: "Frete e loja" };

const CHAVES = [
  "frete_prazo_manuseio_dias",
  "frete_gratis_acima_centavos",
  "retirada_endereco",
  "retirada_horario",
  "banner_texto",
  "banner_link",
];

function reais(centavos: string | undefined) {
  const n = Number(centavos);
  return Number.isInteger(n) && n > 0 ? (n / 100).toFixed(2).replace(".", ",") : "";
}

function Interruptor({ nome, ligado, rotulo }: { nome: string; ligado: boolean; rotulo: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-tinta">
      <input type="checkbox" name={nome} defaultChecked={ligado} className="h-4 w-4 accent-marca" />
      {rotulo}
    </label>
  );
}

export default async function ConfiguracoesPage() {
  await exigirUsuario("configuracoes");
  const c = await lerConfiguracoesDoPainel(CHAVES);
  const melhorEnvioLigado = getShippingProvider() !== null;
  const pagamentoLigado = Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim());

  return (
    <>
      <CabecalhoDaPagina titulo="Frete e loja" apoio="Muda na hora, sem precisar publicar o site de novo." />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Secao titulo="Frete">
          <p className="mb-4 text-sm text-tinta-media">
            A cotação vem do Melhor Envio
            {melhorEnvioLigado ? "" : " — que ainda não está configurado: hoje só a retirada aparece no checkout"}.
            As regras abaixo são aplicadas por cima da cotação.
          </p>
          <FormularioDeAcao acao={acaoSalvarFrete} rotulo="Salvar frete">
            <Campo
              rotulo="Prazo de manuseio (dias úteis)"
              nome="prazoManuseio"
              type="number"
              min={0}
              max={99}
              defaultValue={c.frete_prazo_manuseio_dias?.ligada ? c.frete_prazo_manuseio_dias.valor : "0"}
              ajuda="Tempo entre o pagamento e a postagem. Somado ao prazo da transportadora."
            />
            <div className="space-y-2 rounded-controle border border-neutral-200 p-3">
              <Interruptor
                nome="freteGratisLigado"
                ligado={Boolean(c.frete_gratis_acima_centavos?.ligada)}
                rotulo="Frete grátis acima de um valor"
              />
              <Campo
                rotulo="A partir de (R$)"
                nome="freteGratisAcima"
                inputMode="decimal"
                placeholder="1.500,00"
                defaultValue={reais(c.frete_gratis_acima_centavos?.valor)}
                ajuda="Só a opção de entrega mais barata sai de graça. As mais rápidas continuam cobradas."
              />
            </div>
          </FormularioDeAcao>
        </Secao>

        <Secao titulo="Retirada em Brasília">
          <p className="mb-4 text-sm text-tinta-media">Aparece no checkout e na página do pedido. Retirada é sempre grátis.</p>
          <FormularioDeAcao acao={acaoSalvarRetirada} rotulo="Salvar retirada">
            <Campo
              rotulo="Endereço"
              nome="endereco"
              maxLength={200}
              defaultValue={c.retirada_endereco?.valor ?? ""}
              placeholder="SIA Trecho 3, Lote 625 — Brasília/DF"
            />
            <Campo
              rotulo="Horário"
              nome="horario"
              maxLength={200}
              defaultValue={c.retirada_horario?.valor ?? ""}
              placeholder="Segunda a sexta, 8h às 18h. Sábado, 8h às 12h."
              ajuda="Vazio: a loja diz que o horário é combinado pelo WhatsApp."
            />
          </FormularioDeAcao>
        </Secao>

        <Secao titulo="Faixa promocional da home">
          <FormularioDeAcao acao={acaoSalvarFaixa} rotulo="Salvar faixa">
            <Interruptor nome="ligada" ligado={Boolean(c.banner_texto?.ligada)} rotulo="Mostrar a faixa" />
            <Campo
              rotulo="Texto"
              nome="texto"
              maxLength={140}
              defaultValue={c.banner_texto?.valor ?? ""}
              placeholder="Frete grátis para Brasília em pneus aro 16"
            />
            <Campo
              rotulo="Link (opcional)"
              nome="link"
              maxLength={300}
              defaultValue={c.banner_link?.valor ?? ""}
              placeholder="/pneus?aro=16"
            />
          </FormularioDeAcao>
        </Secao>

        <Secao titulo="Integrações">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-tinta">Pagamento (Mercado Pago)</span>
              <span className={`font-bold ${pagamentoLigado ? "text-green-700" : "text-marca"}`}>
                {pagamentoLigado ? "Ligado" : "Sem credencial"}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-tinta">Cotação de frete (Melhor Envio)</span>
              <span className={`font-bold ${melhorEnvioLigado ? "text-green-700" : "text-marca"}`}>
                {melhorEnvioLigado ? "Ligado" : "Sem credencial"}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-tinta">WhatsApp da loja</span>
              <span className={`font-bold ${process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ? "text-green-700" : "text-marca"}`}>
                {process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ? "Ligado" : "Sem número"}
              </span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-tinta-media">
            Credenciais ficam nas variáveis de ambiente da Vercel, nunca aqui: quem tem acesso ao painel não precisa
            ver a chave do gateway.
          </p>
        </Secao>
      </div>
    </>
  );
}
