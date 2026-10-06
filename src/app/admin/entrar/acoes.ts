"use server";

import { redirect } from "next/navigation";
import { entrar } from "@/lib/sessao-admin";
import type { EstadoDaAcao } from "@/components/painel/estado-da-acao";

export async function acaoEntrar(_anterior: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  const email = String(dados.get("email") ?? "").slice(0, 200);
  const senha = String(dados.get("senha") ?? "").slice(0, 200);
  if (!email || !senha) return { ok: false, mensagem: "Preencha e-mail e senha." };

  const r = await entrar(email, senha);
  if (!r.ok) return { ok: false, mensagem: r.erro };
  redirect("/admin");
}
