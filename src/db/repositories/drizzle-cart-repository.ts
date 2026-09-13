import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { carts, cartItems, productVariants, products } from "@/db/schema";
import type { CartRepository } from "@/core/cart/cart-repository";
import type { Cart, CartItem } from "@/core/cart/types";
import type { StockRepository } from "@/core/stock/stock-repository";
import { normalizarQuantidade } from "@/core/cart/cart-totals";
import { formatTireSize } from "@/core/catalog/tire-size";

export function createDrizzleCartRepository(
  db: Database,
  estoque: StockRepository,
): CartRepository {
  async function carrinhoDoToken(token: string) {
    const [existente] = await db
      .select()
      .from(carts)
      .where(eq(carts.token, token))
      .limit(1);
    if (existente) return existente;

    const [criado] = await db.insert(carts).values({ token }).returning();
    return criado;
  }

  /**
   * Monta o carrinho com os dados atuais do produto e a disponibilidade de
   * agora.
   *
   * O preço é lido na hora e não congelado: enquanto não há pedido, o cliente
   * paga o preço vigente. O congelamento acontece no pedido, onde o item guarda
   * uma cópia.
   */
  async function montar(cartId: string, token: string): Promise<Cart> {
    const linhas = await db
      .select({
        variantId: cartItems.variantId,
        quantity: cartItems.quantity,
        sku: productVariants.sku,
        unitPriceCents: productVariants.priceCents,
        width: productVariants.width,
        profile: productVariants.profile,
        rim: productVariants.rim,
        loadIndex: productVariants.loadIndex,
        speedRating: productVariants.speedRating,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(cartItems.cartId, cartId));

    const disponibilidades = await estoque.disponibilidadeDe(
      linhas.map((l) => l.variantId),
    );
    const porId = new Map(disponibilidades.map((d) => [d.variantId, d]));

    const itens: CartItem[] = linhas.map((l) => ({
      variantId: l.variantId,
      sku: l.sku,
      productName: l.productName,
      productSlug: l.productSlug,
      sizeLabel:
        l.width !== null && l.profile !== null && l.rim !== null
          ? formatTireSize({
              width: l.width,
              profile: l.profile,
              rim: l.rim,
              loadIndex: l.loadIndex,
              speedRating: l.speedRating,
            })
          : null,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      disponivel: porId.get(l.variantId)?.disponivel ?? 0,
    }));

    itens.sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR"));
    return { id: cartId, token, itens };
  }

  const repo: CartRepository = {
    async obterOuCriar(token: string): Promise<Cart> {
      const carrinho = await carrinhoDoToken(token);
      return montar(carrinho.id, token);
    },

    async definirItem(token, variantId, quantity): Promise<Cart> {
      const carrinho = await carrinhoDoToken(token);
      const [disponibilidade] = await estoque.disponibilidadeDe([variantId]);
      const final = normalizarQuantidade(quantity, disponibilidade.disponivel);

      if (final === 0) {
        await db
          .delete(cartItems)
          .where(
            and(
              eq(cartItems.cartId, carrinho.id),
              eq(cartItems.variantId, variantId),
            ),
          );
      } else {
        await db
          .insert(cartItems)
          .values({ cartId: carrinho.id, variantId, quantity: final })
          .onConflictDoUpdate({
            target: [cartItems.cartId, cartItems.variantId],
            set: { quantity: final },
          });
      }

      await db
        .update(carts)
        .set({ updatedAt: new Date() })
        .where(eq(carts.id, carrinho.id));

      return montar(carrinho.id, token);
    },

    async remover(token, variantId): Promise<Cart> {
      return repo.definirItem(token, variantId, 0);
    },

    async limpar(token: string): Promise<void> {
      const carrinho = await carrinhoDoToken(token);
      await db.delete(cartItems).where(eq(cartItems.cartId, carrinho.id));
    },
  };

  return repo;
}
