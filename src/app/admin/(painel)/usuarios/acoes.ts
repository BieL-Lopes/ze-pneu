"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuario } from "@/lib/sessao-admin";
import { alterarUsuario, criarUsuario, definirSenha } from "@/db/usuarios-do-painel";
import { gerarSenhaProvisoria } from "@/core/admin/senha";
import { PAPEIS } from "@/core/admin/papeis";
import type { EstadoDaAcao } from "@/components/painel/estado-da-acao";

const novoUsuario = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(80, "Nome longo demais."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  papel: z.enum(PAPEIS, { error: "Papel inválido." }),
});

export async function acaoCriarUsuario(_a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  await exigirUsuario("usuarios");
  const r = novoUsuario.safeParse({
    nome: dados.get("nome") ?? "",
    email: dados.get("email") ?? "",
    papel: dados.get("papel") ?? "",
  });
  if (!r.success) return { ok: false, mensagem: r.error.issues[0].message };

  const senha = gerarSenhaProvisoria();
  try {
    const criado = await criarUsuario({ ...r.data, senha });
    if (!criado.ok) return { ok: false, mensagem: criado.error };
  } catch (e) {
    console.error("Falha ao criar usuário do painel", e);
    return { ok: false, mensagem: "Não foi possível criar agora. Tente de novo." };
  }
  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    mensagem: `Usuário criado. Senha provisória: ${senha} — passe para ${r.data.nome} por um canal privado; ela não aparece de novo. No primeiro acesso, troque em “Minha conta”.`,
  };
}

export async function acaoNovaSenha(userId: string, nome: string): Promise<EstadoDaAcao> {
  await exigirUsuario("usuarios");
  const senha = gerarSenhaProvisoria();
  try {
    await definirSenha(userId, senha);
  } catch (e) {
    console.error(`Falha ao gerar senha para ${userId}`, e);
    return { ok: false, mensagem: "Não foi possível gerar agora." };
  }
  return { ok: true, mensagem: `Nova senha de ${nome}: ${senha} — ela não aparece de novo.` };
}

export async function acaoAlterarUsuario(userId: string, _a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  const eu = await exigirUsuario("usuarios");
  const papel = String(dados.get("papel") ?? "");
  const ativo = dados.get("ativo") === "on";
  if (!(PAPEIS as readonly string[]).includes(papel)) return { ok: false, mensagem: "Papel inválido." };

  // Ninguém tira o próprio acesso de administrador: o painel ficaria sem
  // ninguém capaz de devolvê-lo.
  if (userId === eu.id && (papel !== "admin" || !ativo)) {
    return { ok: false, mensagem: "Você não pode rebaixar nem desativar a si mesmo." };
  }

  try {
    await alterarUsuario(userId, { papel: papel as (typeof PAPEIS)[number], ativo });
  } catch (e) {
    console.error(`Falha ao alterar usuário ${userId}`, e);
    return { ok: false, mensagem: "Não foi possível salvar agora." };
  }
  revalidatePath("/admin/usuarios");
  return { ok: true, mensagem: ativo ? "Salvo." : "Salvo. As sessões abertas desse usuário foram encerradas." };
}
