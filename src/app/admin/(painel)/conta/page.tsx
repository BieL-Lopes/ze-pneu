import type { Metadata } from "next";
import { exigirUsuario } from "@/lib/sessao-admin";
import { ROTULO_PAPEL } from "@/core/admin/papeis";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { FormularioDeAcao } from "@/components/painel/formulario-de-acao";
import { Campo } from "@/components/painel/campo";
import { acaoTrocarSenha } from "./acoes";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const usuario = await exigirUsuario();

  return (
    <>
      <CabecalhoDaPagina titulo="Minha conta" apoio={`${usuario.email} · ${ROTULO_PAPEL[usuario.papel]}`} />
      <Secao titulo="Trocar senha" className="mt-6 max-w-md">
        <FormularioDeAcao acao={acaoTrocarSenha} rotulo="Trocar senha" rotuloEnviando="Trocando…">
          <Campo rotulo="Senha atual" nome="atual" type="password" autoComplete="current-password" required />
          <Campo
            rotulo="Nova senha"
            nome="nova"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            ajuda="Pelo menos 10 caracteres. Uma frase comprida é mais segura que símbolos."
          />
          <Campo rotulo="Repita a nova senha" nome="confirmacao" type="password" autoComplete="new-password" required />
        </FormularioDeAcao>
        <p className="mt-3 text-xs text-tinta-media">Depois de trocar, todas as sessões são encerradas e você entra de novo.</p>
      </Secao>
    </>
  );
}
