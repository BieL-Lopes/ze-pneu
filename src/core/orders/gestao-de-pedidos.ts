import type { StockRepository } from "@/core/stock/stock-repository";
import { type Result, ok, err } from "@/core/shared/result";
import type { NotaFiscal, OrderRepository } from "./order-repository";
import { ROTULO_STATUS, transicionar, transicoesValidas, type OrderStatus } from "./order-status";

type Dependencias = {
  pedidos: OrderRepository;
  estoque: Pick<StockRepository, "liberarReserva" | "devolverBaixa">;
};

/** Pago, mas o pneu ainda está fisicamente na loja. */
const PNEU_NA_LOJA: OrderStatus[] = ["pago", "em_separacao", "pronto_para_retirada"];

/**
 * O que a operação faz com um pedido pelo painel.
 *
 * O estoque acompanha o status sozinho: quem cancela no painel não precisa
 * lembrar de devolver o pneu à prateleira, e não consegue devolver duas vezes.
 */
/** Próximos status que a operação pode escolher para este pedido. */
export function proximosStatus(status: OrderStatus, recebimento: "retirada" | "entrega"): OrderStatus[] {
  return transicoesValidas[status].filter(
    (s) =>
      s !== "pago" &&
      !(s === "enviado" && recebimento === "retirada") &&
      !(s === "pronto_para_retirada" && recebimento === "entrega"),
  );
}

export function createGestaoDePedidos(deps: Dependencias) {
  return {
    async mudarStatus(
      referencia: string,
      para: OrderStatus,
      opcoes: { autor: string; nota?: string; rastreio?: string },
    ): Promise<Result<string, string>> {
      const pedido = await deps.pedidos.porReferencia(referencia);
      if (!pedido) return err("Pedido não encontrado.");

      const de = pedido.status;
      // "Pago" só pelo provedor: é a confirmação dele que baixa o estoque
      // reservado. Marcar à mão deixaria a reserva viva, e a expiração
      // devolveria à prateleira um pneu já vendido.
      if (para === "pago") {
        return err("O pagamento é confirmado pelo Mercado Pago. Se o cliente pagou, recarregue em instantes.");
      }

      const valida = transicionar(de, para);
      if (!valida.ok) return valida;

      if (para === "enviado" && pedido.recebimento.tipo === "retirada") {
        return err("Pedido de retirada não é enviado: use “Pronto para retirada”.");
      }
      if (para === "pronto_para_retirada" && pedido.recebimento.tipo === "entrega") {
        return err("Pedido de entrega não fica pronto para retirada: use “Enviado”.");
      }

      const rastreio = opcoes.rastreio?.trim();
      if (rastreio) await deps.pedidos.definirRastreio(referencia, rastreio);

      const nota =
        opcoes.nota?.trim() ||
        (rastreio ? `Rastreio ${rastreio}` : `${ROTULO_STATUS[de]} → ${ROTULO_STATUS[para]}`);

      // Condicional no status de partida: se o webhook ou outra pessoa mexeu
      // no pedido enquanto esta tela estava aberta, a mudança não sobrescreve.
      const trocou = await deps.pedidos.transicionar(referencia, de, para, nota, opcoes.autor);
      if (!trocou) return err("O pedido mudou enquanto você editava. Recarregue a página e confira.");

      if (para === "cancelado" && de === "aguardando_pagamento") {
        await deps.estoque.liberarReserva(referencia);
        return ok("Pedido cancelado e reserva devolvida ao estoque.");
      }

      if (para === "cancelado" || para === "estornado") {
        let mensagem = "";
        if (PNEU_NA_LOJA.includes(de)) {
          const unidades = await deps.estoque.devolverBaixa(referencia, opcoes.autor);
          mensagem = `${unidades} unidade(s) voltaram ao estoque.`;
        } else {
          mensagem = "Os pneus já tinham saído da loja: dê entrada no estoque quando voltarem.";
          await deps.pedidos.anotar(referencia, mensagem, opcoes.autor);
        }
        // A porta de pagamento não estorna: devolver o dinheiro é feito no
        // painel do provedor, e o lembrete fica no histórico do pedido.
        if (de !== "aguardando_pagamento" && para === "cancelado") {
          await deps.pedidos.anotar(
            referencia,
            "Pedido pago cancelado: estornar o pagamento no Mercado Pago.",
            opcoes.autor,
          );
          mensagem += " Lembre de estornar o pagamento no Mercado Pago.";
        }
        return ok(`${ROTULO_STATUS[para]}. ${mensagem}`.trim());
      }

      return ok(`Pedido agora está ${ROTULO_STATUS[para].toLowerCase()}.`);
    },

    async registrarRastreio(referencia: string, codigo: string, autor: string): Promise<Result<string, string>> {
      const pedido = await deps.pedidos.porReferencia(referencia);
      if (!pedido) return err("Pedido não encontrado.");
      if (pedido.recebimento.tipo !== "entrega") return err("Pedido de retirada não tem rastreio.");
      const limpo = codigo.trim();
      if (limpo.length > 60) return err("Código de rastreio longo demais.");
      await deps.pedidos.definirRastreio(referencia, limpo || null);
      await deps.pedidos.anotar(referencia, limpo ? `Rastreio ${limpo}` : "Rastreio removido", autor);
      return ok(limpo ? "Rastreio salvo." : "Rastreio removido.");
    },

    async registrarNotaFiscal(
      referencia: string,
      nota: { numero: string; chave: string },
      autor: string,
    ): Promise<Result<string, string>> {
      const pedido = await deps.pedidos.porReferencia(referencia);
      if (!pedido) return err("Pedido não encontrado.");

      const numero = nota.numero.trim();
      const chave = nota.chave.replace(/\D/g, "");
      if (chave && chave.length !== 44) return err("A chave de acesso da NF-e tem 44 dígitos.");
      if (!numero && chave) return err("Informe o número da nota.");

      const valor: NotaFiscal | null = numero ? { numero, chave: chave || null } : null;
      await deps.pedidos.definirNotaFiscal(referencia, valor);
      await deps.pedidos.anotar(referencia, valor ? `Nota fiscal ${numero} registrada` : "Nota fiscal removida", autor);
      return ok(valor ? "Nota fiscal salva." : "Nota fiscal removida.");
    },

    async anotar(referencia: string, texto: string, autor: string): Promise<Result<string, string>> {
      const limpo = texto.trim();
      if (!limpo) return err("Escreva a anotação.");
      if (limpo.length > 1000) return err("Anotação longa demais.");
      await deps.pedidos.anotar(referencia, limpo, autor);
      return ok("Anotação registrada.");
    },
  };
}
