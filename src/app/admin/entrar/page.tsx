import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao-admin";
import { FormularioDeAcao } from "@/components/painel/formulario-de-acao";
import { Campo } from "@/components/painel/campo";
import { acaoEntrar } from "./acoes";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function EntrarPage() {
  if (await usuarioAtual()) redirect("/admin");

  return (
    <main className="flex flex-1 items-center justify-center bg-tinta px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="text-center text-3xl font-black uppercase italic tracking-tight text-white">
          Zé<span className="text-marca">Pneu</span>
        </p>
        <p className="mt-1 text-center text-xs font-bold uppercase tracking-widest text-tinta-clara">
          Painel da loja
        </p>
        <div className="mt-8 rounded-controle border-t-4 border-marca bg-white p-6">
          <FormularioDeAcao acao={acaoEntrar} rotulo="Entrar" rotuloEnviando="Entrando…" tamanho="grande">
            <Campo rotulo="E-mail" nome="email" type="email" autoComplete="username" required autoFocus />
            <Campo rotulo="Senha" nome="senha" type="password" autoComplete="current-password" required />
          </FormularioDeAcao>
        </div>
        <p className="mt-6 text-center text-xs text-tinta-clara">
          Esqueceu a senha? Peça a um administrador para gerar uma nova.
        </p>
      </div>
    </main>
  );
}
