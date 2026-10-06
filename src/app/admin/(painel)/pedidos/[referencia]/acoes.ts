"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/sessao-admin";
import { getGestaoDePedidos } from "@/lib/container";
import { ORDER_STATUSES } from "@/db/schema";
import type { OrderStatus } from "@/core/orders/order-status";
import type { EstadoDaAcao } from "@/components/painel/estado-da-acao";
import type { Result } from "@/core/shared/result";

function campo(dados: FormData, nome: string, max = 200): string {
  return String(dados.get(nome) ?? "").slice(0, max);
}

async function executar(referencia: string, tarefa: () => Promise<Result<string, string>>): Promise<EstadoDaAcao> {
  try {
    const r = await tarefa();
    revalidatePath(`/admin/pedidos/${referencia}`);
    return r.ok ? { ok: true, mensagem: r.value } : { ok: false, mensagem: r.error };
  } catch (e) {
    console.error(`Falha ao atualizar o pedido ${referencia} pelo painel`, e);
    return { ok: false, mensagem: "Não foi possível salvar agora. Tente de novo." };
  }
}

export async function acaoMudarStatus(
  referencia: string,
  para: OrderStatus,
  _anterior: EstadoDaAcao,
  dados: FormData,
): Promise<EstadoDaAcao> {
  const usuario = await exigirUsuario("pedidos");
  if (!(ORDER_STATUSES as readonly string[]).includes(para)) return { ok: false, mensagem: "Status inválido." };
  const gestao = await getGestaoDePedidos();
  return executar(referencia, () =>
    gestao.mudarStatus(referencia, para, {
      autor: usuario.email,
      nota: campo(dados, "nota", 500),
      rastreio: campo(dados, "rastreio", 60),
    }),
  );
}

export async function acaoRastreio(referencia: string, _a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  const usuario = await exigirUsuario("pedidos");
  const gestao = await getGestaoDePedidos();
  return executar(referencia, () => gestao.registrarRastreio(referencia, campo(dados, "rastreio", 80), usuario.email));
}

export async function acaoNotaFiscal(referencia: string, _a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  const usuario = await exigirUsuario("pedidos");
  const gestao = await getGestaoDePedidos();
  return executar(referencia, () =>
    gestao.registrarNotaFiscal(
      referencia,
      { numero: campo(dados, "numero", 20), chave: campo(dados, "chave", 80) },
      usuario.email,
    ),
  );
}

export async function acaoAnotar(referencia: string, _a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  const usuario = await exigirUsuario("pedidos");
  const gestao = await getGestaoDePedidos();
  return executar(referencia, () => gestao.anotar(referencia, campo(dados, "texto", 1000), usuario.email));
}
