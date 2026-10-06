"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { Botao, type TamanhoBotao, type VarianteBotao } from "@/components/ui/botao";
import type { AcaoDoPainel } from "./estado-da-acao";

type Props = {
  acao: AcaoDoPainel;
  children?: ReactNode;
  rotulo: string;
  rotuloEnviando?: string;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  /** Pergunta antes de enviar. Para o que não tem volta, como cancelar pedido. */
  confirmar?: string;
  /** Esvazia os campos depois de um envio bem-sucedido. */
  limparAoConcluir?: boolean;
  className?: string;
  classeDosCampos?: string;
};

/**
 * Formulário de toda ação do painel.
 *
 * Um só componente para o resultado aparecer igual em todo lugar: verde quando
 * deu certo, vermelho com o motivo quando não deu. O botão trava durante o
 * envio para que o duplo clique não lance a mesma entrada de estoque duas vezes.
 */
export function FormularioDeAcao({
  acao,
  children,
  rotulo,
  rotuloEnviando = "Salvando…",
  variante = "primaria",
  tamanho = "medio",
  confirmar,
  limparAoConcluir = false,
  className = "",
  classeDosCampos = "space-y-4",
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok && limparAoConcluir) form.current?.reset();
  }, [estado, limparAoConcluir]);

  return (
    <form
      ref={form}
      className={className}
      // Envio pelo onSubmit, e não por `action`: com `action` o React 19
      // esvazia o formulário depois de todo envio, inclusive do recusado — e
      // quem errou um campo teria de redigitar todos.
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmar && !window.confirm(confirmar)) return;
        const dados = new FormData(e.currentTarget);
        startTransition(() => enviar(dados));
      }}
    >
      {children && <div className={classeDosCampos}>{children}</div>}
      <div className={children ? "mt-4" : ""}>
        <Botao type="submit" variante={variante} tamanho={tamanho} disabled={enviando}>
          {enviando ? rotuloEnviando : rotulo}
        </Botao>
      </div>
      {estado && (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`mt-3 text-sm font-semibold ${estado.ok ? "text-green-700" : "text-marca"}`}
        >
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}
