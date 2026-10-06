import type { Metadata } from "next";
import { exigirUsuario } from "@/lib/sessao-admin";
import { listarUsuarios } from "@/db/consultas-do-painel";
import { PAPEIS, ROTULO_PAPEL } from "@/core/admin/papeis";
import { classesDeCampo } from "@/components/ui/botao";
import { CabecalhoDaPagina, Secao } from "@/components/painel/cabecalho-da-pagina";
import { FormularioDeAcao } from "@/components/painel/formulario-de-acao";
import { Campo, rotuloDeCampo } from "@/components/painel/campo";
import { acaoAlterarUsuario, acaoCriarUsuario, acaoNovaSenha } from "./acoes";

export const metadata: Metadata = { title: "Usuários" };

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function UsuariosPage() {
  const eu = await exigirUsuario("usuarios");
  const usuarios = await listarUsuarios();

  return (
    <>
      <CabecalhoDaPagina
        titulo="Usuários"
        apoio="Operador cuida de pedidos e estoque. Administrador também mexe em produtos, preços, frete e acessos."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {usuarios.map((u) => (
            <Secao key={u.id} titulo={u.nome}>
              <p className="-mt-2 mb-3 break-all text-sm text-tinta-media">
                {u.email}
                {u.id === eu.id && " · você"}
                {" · "}
                {u.ultimoAcesso ? `último acesso ${dataHora.format(u.ultimoAcesso)}` : "nunca entrou"}
              </p>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <FormularioDeAcao
                  acao={acaoAlterarUsuario.bind(null, u.id)}
                  rotulo="Salvar"
                  variante="sutil"
                  tamanho="pequeno"
                  classeDosCampos="flex flex-wrap items-center gap-4"
                >
                  <label className="sr-only" htmlFor={`papel-${u.id}`}>Papel</label>
                  <select id={`papel-${u.id}`} name="papel" defaultValue={u.papel} className={classesDeCampo("py-2")}>
                    {PAPEIS.map((p) => (
                      <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm font-semibold text-tinta">
                    <input type="checkbox" name="ativo" defaultChecked={u.ativo} className="h-4 w-4 accent-marca" />
                    Acesso liberado
                  </label>
                </FormularioDeAcao>
                {u.id !== eu.id && (
                  <FormularioDeAcao
                    acao={acaoNovaSenha.bind(null, u.id, u.nome)}
                    rotulo="Gerar nova senha"
                    rotuloEnviando="Gerando…"
                    variante="sutil"
                    tamanho="pequeno"
                    confirmar={`Gerar uma nova senha para ${u.nome}? A senha atual deixa de funcionar na hora.`}
                  />
                )}
              </div>
            </Secao>
          ))}
        </div>

        <Secao titulo="Novo usuário">
          <FormularioDeAcao acao={acaoCriarUsuario} rotulo="Criar acesso" limparAoConcluir>
            <Campo rotulo="Nome" nome="nome" required maxLength={80} />
            <Campo rotulo="E-mail" nome="email" type="email" required />
            <div>
              <label htmlFor="campo-papel" className={rotuloDeCampo()}>Papel</label>
              <select id="campo-papel" name="papel" defaultValue="operador" className={classesDeCampo("mt-1.5 w-full")}>
                {PAPEIS.map((p) => (
                  <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>
                ))}
              </select>
            </div>
          </FormularioDeAcao>
          <p className="mt-3 text-xs text-tinta-media">
            Uma senha provisória aparece uma única vez depois de criar. Passe para a pessoa por um canal privado.
          </p>
        </Secao>
      </div>
    </>
  );
}
