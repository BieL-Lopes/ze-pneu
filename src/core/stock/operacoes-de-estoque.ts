import { type Result, ok, err } from "@/core/shared/result";
import type { StockRepository } from "./stock-repository";

type Dependencias = {
  estoque: Pick<StockRepository, "disponibilidadeDe" | "registrarEntrada" | "ajustar">;
};

const MAXIMO_POR_LANCAMENTO = 10_000;

function motivoValido(motivo: string): string | null {
  const limpo = motivo.trim();
  if (limpo.length < 3) return null;
  return limpo.slice(0, 300);
}

/**
 * Lançamentos manuais de estoque, feitos pelo painel.
 *
 * Todo lançamento exige motivo e grava o autor: sem isso, divergência de
 * inventário não tem como ser investigada.
 */
export function createOperacoesDeEstoque(deps: Dependencias) {
  return {
    async darEntrada(args: {
      variantId: string;
      quantidade: number;
      motivo: string;
      autor: string;
    }): Promise<Result<string, string>> {
      if (!Number.isInteger(args.quantidade) || args.quantidade <= 0) {
        return err("A quantidade de entrada precisa ser um número inteiro maior que zero.");
      }
      if (args.quantidade > MAXIMO_POR_LANCAMENTO) return err("Quantidade alta demais para um lançamento.");
      const motivo = motivoValido(args.motivo);
      if (!motivo) return err("Informe de onde veio a mercadoria (ex: NF 1234 do fornecedor).");

      await deps.estoque.registrarEntrada({
        variantId: args.variantId,
        quantity: args.quantidade,
        reason: motivo,
        authorId: args.autor,
      });
      return ok(`Entrada de ${args.quantidade} unidade(s) registrada.`);
    },

    /**
     * Ajuste para mais ou para menos — contagem de inventário, avaria, perda.
     *
     * Não deixa o físico ficar abaixo do que está reservado para pedidos em
     * aberto: seria vender um pneu que já não existe.
     */
    async ajustar(args: {
      variantId: string;
      delta: number;
      motivo: string;
      autor: string;
    }): Promise<Result<string, string>> {
      if (!Number.isInteger(args.delta) || args.delta === 0) {
        return err("Informe quantas unidades somar (positivo) ou tirar (negativo).");
      }
      if (Math.abs(args.delta) > MAXIMO_POR_LANCAMENTO) return err("Quantidade alta demais para um ajuste.");
      const motivo = motivoValido(args.motivo);
      if (!motivo) return err("O motivo do ajuste é obrigatório.");

      const [saldo] = await deps.estoque.disponibilidadeDe([args.variantId]);
      const novoFisico = saldo.onHand + args.delta;
      if (novoFisico < 0) return err(`Só há ${saldo.onHand} unidade(s) no físico.`);
      if (novoFisico < saldo.reserved) {
        return err(
          `${saldo.reserved} unidade(s) estão reservadas para pedidos em aberto. O físico não pode ficar abaixo disso.`,
        );
      }

      await deps.estoque.ajustar({
        variantId: args.variantId,
        delta: args.delta,
        reason: motivo,
        authorId: args.autor,
      });
      return ok(`Ajuste de ${args.delta > 0 ? "+" : ""}${args.delta} registrado. Físico agora: ${novoFisico}.`);
    },
  };
}
