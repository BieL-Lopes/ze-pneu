import type { Metadata } from "next";
import Link from "next/link";
import { getCartRepository } from "@/lib/container";
import { lerTokenDoCarrinho } from "@/lib/cart-cookie";
import { calcularTotais } from "@/core/cart/cart-totals";
import { formatBRL } from "@/lib/format";
import { LinhaDoCarrinho } from "@/components/carrinho/linha-do-carrinho";
import { Botao, BotaoLink } from "@/components/ui/botao";

export const metadata: Metadata = {
  title: "Carrinho",
  robots: { index: false },
};

// O carrinho é por cookie e muda a cada ação: nunca pode vir de cache.
export const dynamic = "force-dynamic";

export default async function CarrinhoPage() {
  // Sem cookie, o visitante ainda não adicionou nada: carrinho vazio, sem
  // tocar no banco.
  const token = await lerTokenDoCarrinho();
  const itens = token
    ? (await (await getCartRepository()).obterOuCriar(token)).itens
    : [];
  const totais = calcularTotais(itens);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl font-black uppercase italic tracking-tight text-tinta">
        Carrinho
      </h1>

      {itens.length === 0 ? (
        <div className="mt-12 rounded-controle border border-dashed border-neutral-300 p-16 text-center">
          <p className="text-tinta-media">Seu carrinho está vazio.</p>
          <BotaoLink href="/pneus" tamanho="grande" className="mt-6">
            Ver pneus
          </BotaoLink>
        </div>
      ) : (
        <>
          <p className="numerais-tabulares mt-2 text-sm font-medium uppercase tracking-wide text-tinta-media">
            {totais.quantidadeTotal}{" "}
            {totais.quantidadeTotal === 1 ? "item" : "itens"}
          </p>

          <ul className="mt-8">
            {itens.map((item) => (
              <LinhaDoCarrinho key={item.variantId} item={item} />
            ))}
          </ul>

          <div className="mt-8 border-t-4 border-tinta pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold uppercase tracking-widest text-tinta-media">
                Subtotal
              </span>
              <span className="numerais-tabulares text-3xl font-black text-tinta">
                {formatBRL(totais.itemsTotalCents)}
              </span>
            </div>
            <p className="mt-2 text-right text-sm text-tinta-media">
              Frete calculado pelo CEP no próximo passo. Retirada em Brasília é grátis.
            </p>

            {totais.temItemIndisponivel && (
              <p
                role="alert"
                className="mt-6 border border-marca p-4 text-sm font-semibold text-marca"
              >
                Ajuste os itens marcados acima antes de continuar.
              </p>
            )}

            {/*
              Com item acima do estoque, o botão fica inerte: o checkout
              recusaria de qualquer jeito, e é aqui que o cliente ajusta.
            */}
            {totais.temItemIndisponivel ? (
              <Botao disabled tamanho="grande" larguraTotal className="mt-6">
                Finalizar compra
              </Botao>
            ) : (
              <BotaoLink href="/checkout" tamanho="grande" larguraTotal className="mt-6">
                Finalizar compra
              </BotaoLink>
            )}

            <Link
              href="/pneus"
              className="mt-3 block text-center text-sm font-bold text-marca transition hover:text-marca-escura"
            >
              Continuar comprando
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
