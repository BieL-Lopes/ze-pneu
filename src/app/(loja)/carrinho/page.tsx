import type { Metadata } from "next";
import Link from "next/link";
import { getCartRepository } from "@/lib/container";
import { tokenDoCarrinho } from "@/lib/cart-cookie";
import { calcularTotais } from "@/core/cart/cart-totals";
import { formatBRL } from "@/lib/format";
import { LinhaDoCarrinho } from "@/components/carrinho/linha-do-carrinho";

export const metadata: Metadata = {
  title: "Carrinho",
  robots: { index: false },
};

// O carrinho é por cookie e muda a cada ação: nunca pode vir de cache.
export const dynamic = "force-dynamic";

export default async function CarrinhoPage() {
  const carrinho = await getCartRepository();
  const { itens } = await carrinho.obterOuCriar(await tokenDoCarrinho());
  const totais = calcularTotais(itens);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl font-black uppercase italic tracking-tight text-tinta">
        Carrinho
      </h1>

      {itens.length === 0 ? (
        <div className="mt-12 border border-dashed border-neutral-300 p-16 text-center">
          <p className="text-tinta-media">Seu carrinho está vazio.</p>
          <Link
            href="/pneus"
            className="mt-6 inline-block bg-marca px-8 py-4 text-base font-bold uppercase tracking-wide text-white transition hover:bg-marca-escura"
          >
            Ver pneus
          </Link>
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
              Frete calculado na próxima etapa.
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
              Desabilitado de propósito: o checkout é o Plano 3. Deixar o botão
              visível e inerte é honesto com quem navega e evita que o layout
              mude de forma quando o checkout chegar.
            */}
            <button
              type="button"
              disabled
              title="O checkout entra na próxima etapa do projeto"
              className="mt-6 w-full bg-marca px-6 py-4 text-base font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
            >
              Finalizar compra
            </button>

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
