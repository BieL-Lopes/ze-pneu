import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCartRepository,
  getConfiguracoes,
  getPaymentProvider,
  getShippingProvider,
} from "@/lib/container";
import { lerTokenDoCarrinho } from "@/lib/cart-cookie";
import { calcularTotais } from "@/core/cart/cart-totals";
import { FormularioCheckout } from "@/components/checkout/formulario-checkout";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { IconeWhatsApp } from "@/components/icones";
import { classesDeBotao } from "@/components/ui/botao";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false },
};

// Lê o carrinho do cookie: nunca pode vir de cache.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const token = await lerTokenDoCarrinho();
  if (!token) redirect("/carrinho");
  const { itens } = await (await getCartRepository()).obterOuCriar(token);
  const totais = calcularTotais(itens);

  // O carrinho é onde se resolve item esgotado ou acima do estoque; aqui só
  // chega carrinho que pode ser comprado.
  if (itens.length === 0 || totais.temItemIndisponivel) redirect("/carrinho");

  const config = await getConfiguracoes(["retirada_endereco", "retirada_horario"]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-black uppercase italic tracking-tight text-tinta">
        Finalizar compra
      </h1>

      <FormularioCheckout
        itens={itens.map((i) => ({
          variantId: i.variantId,
          nome: i.productName,
          medida: i.sizeLabel,
          quantidade: i.quantity,
          subtotalCents: i.unitPriceCents * i.quantity,
        }))}
        subtotalCents={totais.itemsTotalCents}
        retirada={{
          endereco: config.retirada_endereco ?? null,
          horario: config.retirada_horario ?? null,
        }}
        entregaDisponivel={getShippingProvider() !== null}
        pagamentoDisponivel={getPaymentProvider() !== null}
        avisoSemPagamento={
          <div className="rounded-controle border border-neutral-300 p-4 text-sm text-tinta">
            <p className="font-bold">O pagamento online está indisponível no momento.</p>
            <p className="mt-1 text-tinta-media">Fale com a gente e fechamos seu pedido pelo WhatsApp.</p>
            <WhatsAppLink
              mensagem={`Olá! Quero comprar: ${itens
                .map((i) => `${i.quantity}x ${i.productName} ${i.sizeLabel ?? ""}`.trim())
                .join("; ")}.`}
              className={classesDeBotao({ variante: "contorno", larguraTotal: true, extra: "mt-4" })}
            >
              <IconeWhatsApp className="h-5 w-5" />
              Comprar pelo WhatsApp
            </WhatsAppLink>
          </div>
        }
      />
    </main>
  );
}
