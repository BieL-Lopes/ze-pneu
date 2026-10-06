import { ROTULO_STATUS, type OrderStatus } from "@/core/orders/order-status";

// Cor por urgência para a operação, não por "bom ou ruim": vermelho é o que
// precisa de alguém agora.
const COR: Record<OrderStatus, string> = {
  aguardando_pagamento: "bg-neutral-100 text-tinta-media",
  pago: "bg-marca text-white",
  em_separacao: "bg-amber-100 text-amber-900",
  pronto_para_retirada: "bg-sky-100 text-sky-900",
  enviado: "bg-sky-100 text-sky-900",
  entregue: "bg-green-100 text-green-900",
  retirado: "bg-green-100 text-green-900",
  cancelado: "bg-neutral-200 text-tinta-media line-through",
  estornado: "bg-neutral-200 text-tinta-media",
};

export function SeloDeStatus({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-controle px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${COR[status]}`}>
      {ROTULO_STATUS[status]}
    </span>
  );
}
