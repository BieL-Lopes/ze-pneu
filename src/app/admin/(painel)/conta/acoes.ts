"use server";

import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/sessao-admin";
import { definirSenha, senhaConfere } from "@/db/usuarios-do-painel";
import { problemaNaSenha } from "@/core/admin/senha";
import type { EstadoDaAcao } from "@/components/painel/estado-da-acao";

export async function acaoTrocarSenha(_a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  const usuario = await exigirUsuario();
  const atual = String(dados.get("atual") ?? "").slice(0, 200);
  const nova = String(dados.get("nova") ?? "").slice(0, 300);
  const confirmacao = String(dados.get("confirmacao") ?? "").slice(0, 300);

  if (!(await senhaConfere(usuario.id, atual))) return { ok: false, mensagem: "A senha atual não confere." };
  const problema = problemaNaSenha(nova);
  if (problema) return { ok: false, mensagem: problema };
  if (nova !== confirmacao) return { ok: false, mensagem: "A confirmação não é igual à nova senha." };
  if (nova === atual) return { ok: false, mensagem: "A nova senha precisa ser diferente da atual." };

  try {
    await definirSenha(usuario.id, nova);
  } catch (e) {
    console.error(`Falha ao trocar a senha de ${usuario.id}`, e);
    return { ok: false, mensagem: "Não foi possível trocar agora. Tente de novo." };
  }
  // Trocar a senha encerra todas as sessões, inclusive esta.
  redirect("/admin/entrar");
}
