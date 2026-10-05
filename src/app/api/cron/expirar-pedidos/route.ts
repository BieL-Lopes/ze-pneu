import { getCheckoutService } from "@/lib/container";

export const dynamic = "force-dynamic";

/**
 * Cancela pedidos não pagos no prazo e devolve o estoque.
 *
 * O mesmo trabalho roda no início de cada checkout; esta rota é a rede de
 * segurança para quando ninguém compra. A Vercel envia CRON_SECRET no
 * Authorization. Sem segredo configurado a rota fica fechada, e não aberta.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }

  const checkout = await getCheckoutService();
  const cancelados = await checkout.expirarVencidos();
  return Response.json({ cancelados });
}
