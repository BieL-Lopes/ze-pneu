import { getConfirmacaoDePagamento } from "@/lib/container";
import { validarAssinaturaMercadoPago } from "@/integrations/mercado-pago";

export const dynamic = "force-dynamic";

/**
 * Aviso de mudança de pagamento do Mercado Pago.
 *
 * O aviso não é fonte da verdade: depois de conferir a assinatura, o status é
 * lido da API do provedor. Responder 200 rápido importa — sem isso o Mercado
 * Pago reenvia, e o reenvio é seguro, mas desnecessário.
 */
export async function POST(request: Request) {
  const segredo = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (!segredo) {
    console.error("MERCADO_PAGO_WEBHOOK_SECRET não configurada: aviso recusado");
    return new Response("Webhook não configurado", { status: 503 });
  }

  const url = new URL(request.url);
  let corpo: { type?: string; data?: { id?: string | number } } = {};
  try {
    corpo = await request.json();
  } catch {
    // Corpo vazio ou inválido: o id ainda pode vir na URL.
  }

  const tipo = url.searchParams.get("type") ?? corpo.type;
  // A assinatura é calculada sobre o id da URL.
  const dataId = url.searchParams.get("data.id") ?? (corpo.data?.id != null ? String(corpo.data.id) : null);

  const assinaturaValida = validarAssinaturaMercadoPago(segredo, {
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (!assinaturaValida) return new Response("Assinatura inválida", { status: 401 });

  // Outros tópicos (merchant_order, por exemplo) não mudam o pedido.
  if (tipo !== "payment" || !dataId) return new Response(null, { status: 200 });

  const confirmacao = await getConfirmacaoDePagamento();
  if (!confirmacao) return new Response("Pagamento não configurado", { status: 503 });

  try {
    const r = await confirmacao.processar(dataId);
    if (!r.ok) console.error(`Aviso do pagamento ${dataId}: ${r.error}`);
  } catch (e) {
    // 500 faz o Mercado Pago tentar de novo mais tarde.
    console.error(`Falha ao processar o pagamento ${dataId}`, e);
    return new Response("Erro ao processar", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
