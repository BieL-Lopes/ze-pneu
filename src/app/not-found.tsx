import { Cabecalho } from "@/components/layout/cabecalho";
import { Rodape } from "@/components/layout/rodape";
import { BotaoLink } from "@/components/ui/botao";

/** 404 com a moldura da loja: quem cai num link quebrado continua na loja. */
export default function NaoEncontrado() {
  return (
    <>
      <Cabecalho />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-24 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-marca">Erro 404</p>
        <h1 className="mt-2 text-4xl font-black uppercase italic tracking-tight text-tinta">Página não encontrada</h1>
        <p className="mt-4 text-tinta-media">O endereço pode ter mudado, ou o produto saiu de linha.</p>
        <BotaoLink href="/pneus" tamanho="grande" className="mt-8">
          Ver pneus
        </BotaoLink>
      </main>
      <Rodape />
    </>
  );
}
