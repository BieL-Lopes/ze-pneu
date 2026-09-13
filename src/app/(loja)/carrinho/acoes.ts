"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCartRepository } from "@/lib/container";
import { tokenDoCarrinho } from "@/lib/cart-cookie";
import { LIMITE_POR_ITEM } from "@/core/cart/cart-totals";

const entrada = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).max(LIMITE_POR_ITEM),
});

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

export async function definirItemDoCarrinho(
  dados: FormData,
): Promise<ResultadoAcao> {
  const parsed = entrada.safeParse({
    variantId: dados.get("variantId"),
    quantity: dados.get("quantity"),
  });

  if (!parsed.success) {
    return { ok: false, erro: "Quantidade inválida." };
  }

  try {
    const carrinho = await getCartRepository();
    await carrinho.definirItem(
      await tokenDoCarrinho(),
      parsed.data.variantId,
      parsed.data.quantity,
    );
  } catch (erro) {
    console.error("Falha ao alterar o carrinho", erro);
    return { ok: false, erro: "Não foi possível atualizar o carrinho." };
  }

  revalidatePath("/carrinho");
  return { ok: true };
}

export async function removerDoCarrinho(
  dados: FormData,
): Promise<ResultadoAcao> {
  const variantId = String(dados.get("variantId") ?? "");
  if (!z.string().uuid().safeParse(variantId).success) {
    return { ok: false, erro: "Item inválido." };
  }

  try {
    const carrinho = await getCartRepository();
    await carrinho.remover(await tokenDoCarrinho(), variantId);
  } catch (erro) {
    console.error("Falha ao remover do carrinho", erro);
    return { ok: false, erro: "Não foi possível remover o item." };
  }

  revalidatePath("/carrinho");
  return { ok: true };
}
