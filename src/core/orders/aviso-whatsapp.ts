import type { Pedido } from "./order-repository";
import type { OrderStatus } from "./order-status";

/**
 * Aviso de status para o cliente, pelo WhatsApp da loja.
 *
 * Na Fase 1 o aviso é click-to-chat: o painel monta a mensagem e abre a
 * conversa com o cliente, e o operador só aperta enviar. O envio automático
 * pela Cloud API do WhatsApp fica para depois do lançamento — exige conta
 * Business verificada e modelo de mensagem aprovado pela Meta.
 */
const TEXTO: Partial<Record<OrderStatus, (p: Pedido) => string>> = {
  aguardando_pagamento: (p) =>
    `recebemos o seu pedido ${p.reference}, mas o pagamento ainda não foi confirmado. Se precisar de ajuda para pagar, é só responder aqui.`,
  pago: (p) => `o pagamento do pedido ${p.reference} foi confirmado. Já vamos separar os seus pneus.`,
  em_separacao: (p) => `os pneus do pedido ${p.reference} estão sendo separados.`,
  pronto_para_retirada: (p) =>
    `o pedido ${p.reference} está pronto para retirada na loja Zé Pneu em Brasília. Traga um documento com foto.`,
  enviado: (p) =>
    p.rastreio
      ? `o pedido ${p.reference} foi enviado. Código de rastreio: ${p.rastreio}.`
      : `o pedido ${p.reference} foi enviado.`,
  entregue: (p) => `o pedido ${p.reference} consta como entregue. Boa estrada!`,
  retirado: (p) => `obrigado por retirar o pedido ${p.reference}. Boa estrada!`,
  cancelado: (p) => `o pedido ${p.reference} foi cancelado. Qualquer dúvida, é só responder aqui.`,
  estornado: (p) => `o pagamento do pedido ${p.reference} foi estornado.`,
};

export function mensagemDeStatus(pedido: Pedido, linkDoPedido: string): string {
  const primeiroNome = pedido.comprador.nome.trim().split(/\s+/)[0];
  const corpo = TEXTO[pedido.status]?.(pedido) ?? `o pedido ${pedido.reference} foi atualizado.`;
  return `Olá, ${primeiroNome}! Aqui é do Zé Pneu: ${corpo}\n\nAcompanhe o pedido: ${linkDoPedido}`;
}

/**
 * Link wa.me para o telefone do cliente. O checkout guarda DDD + número; o
 * WhatsApp exige o DDI na frente.
 */
export function linkDeConversa(telefone: string, mensagem: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(digitos)) return null;
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(mensagem)}`;
}
