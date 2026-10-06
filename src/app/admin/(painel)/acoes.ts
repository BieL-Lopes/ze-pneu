"use server";

import { redirect } from "next/navigation";
import { sair } from "@/lib/sessao-admin";

export async function acaoSair() {
  await sair();
  redirect("/admin/entrar");
}
