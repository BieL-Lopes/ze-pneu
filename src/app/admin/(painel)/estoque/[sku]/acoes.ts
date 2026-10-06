"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/sessao-admin";
import { getOperacoesDeEstoque } from "@/lib/container";
import type { Result } from "@/core/shared/result";
import type { EstadoDaAcao } from "@/components/painel/estado-da-acao";

function inteiro(valor: FormDataEntryValue | null): number {
  const texto = String(valor ?? "").trim().replace(/^\+/, "");
  return /^-?\d+$/.test(texto) ? Number(texto) : NaN;
}

async function executar(sku: string, tarefa: () => Promise<Result<string, string>>): Promise<EstadoDaAcao> {
  try {
    const r = await tarefa();
    revalidatePath(`/admin/estoque/${encodeURIComponent(sku)}`);
    return r.ok ? { ok: true, mensagem: r.value } : { ok: false, mensagem: r.error };
  } catch (e) {
    console.error(`Falha ao lançar estoque do SKU ${sku}`, e);
    return { ok: false, mensagem: "Não foi possível lançar agora. Tente de novo." };
  }
}

export async function acaoEntrada(
  variantId: string,
  sku: string,
  _anterior: EstadoDaAcao,
  dados: FormData,
): Promise<EstadoDaAcao> {
  const usuario = await exigirUsuario("estoque");
  const ops = await getOperacoesDeEstoque();
  return executar(sku, () =>
    ops.darEntrada({
      variantId,
      quantidade: inteiro(dados.get("quantidade")),
      motivo: String(dados.get("motivo") ?? ""),
      autor: usuario.email,
    }),
  );
}

export async function acaoAjuste(
  variantId: string,
  sku: string,
  _anterior: EstadoDaAcao,
  dados: FormData,
): Promise<EstadoDaAcao> {
  const usuario = await exigirUsuario("estoque");
  const ops = await getOperacoesDeEstoque();
  return executar(sku, () =>
    ops.ajustar({
      variantId,
      delta: inteiro(dados.get("delta")),
      motivo: String(dados.get("motivo") ?? ""),
      autor: usuario.email,
    }),
  );
}
