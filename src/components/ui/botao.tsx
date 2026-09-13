import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Botão do Zé Pneu.
 *
 * Existe porque a classe de botão estava escrita à mão em doze arquivos e as
 * peças divergiram: umas arredondadas, outras não. Aqui a decisão é uma só.
 *
 * `Botao` é `<button>`, `BotaoLink` é navegação. São separados de propósito:
 * um componente polimórfico esconderia, atrás de uma prop, a diferença entre
 * executar uma ação e ir para outro lugar — que é justamente o que decide se
 * o teclado e o leitor de tela tratam aquilo como botão ou como link.
 */

export type VarianteBotao = "primaria" | "escura" | "contorno" | "sutil";
export type TamanhoBotao = "pequeno" | "medio" | "grande";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-controle font-bold uppercase tracking-wide transition disabled:cursor-not-allowed";

const VARIANTES: Record<VarianteBotao, string> = {
  // Ação principal da tela.
  primaria:
    "bg-marca text-white hover:bg-marca-escura disabled:bg-neutral-300 disabled:text-neutral-500",
  // Sobre o campo vermelho da marca, onde o vermelho não teria contraste.
  escura: "bg-tinta text-white hover:bg-black disabled:opacity-40",
  // Ação secundária que ainda precisa de peso.
  contorno:
    "border border-tinta text-tinta hover:bg-tinta hover:text-white disabled:opacity-40",
  // Escolha entre muitas, como atalho de aro ou medida.
  sutil:
    "border border-neutral-300 text-tinta hover:border-tinta disabled:opacity-40",
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  pequeno: "px-4 py-2 text-sm",
  medio: "px-6 py-3 text-sm",
  grande: "px-8 py-4 text-base",
};

type Aparencia = {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  larguraTotal?: boolean;
};

export function classesDeBotao({
  variante = "primaria",
  tamanho = "medio",
  larguraTotal = false,
  extra = "",
}: Aparencia & { extra?: string } = {}): string {
  return [
    BASE,
    VARIANTES[variante],
    TAMANHOS[tamanho],
    larguraTotal ? "w-full" : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

type BotaoProps = Aparencia &
  Omit<ComponentProps<"button">, "className"> & {
    className?: string;
    children: ReactNode;
  };

export function Botao({
  variante,
  tamanho,
  larguraTotal,
  className = "",
  type = "button",
  children,
  ...resto
}: BotaoProps) {
  return (
    <button
      type={type}
      className={classesDeBotao({
        variante,
        tamanho,
        larguraTotal,
        extra: className,
      })}
      {...resto}
    >
      {children}
    </button>
  );
}

type BotaoLinkProps = Aparencia &
  Omit<ComponentProps<typeof Link>, "className"> & {
    className?: string;
    children: ReactNode;
  };

export function BotaoLink({
  variante,
  tamanho,
  larguraTotal,
  className = "",
  children,
  ...resto
}: BotaoLinkProps) {
  return (
    <Link
      className={classesDeBotao({
        variante,
        tamanho,
        larguraTotal,
        extra: className,
      })}
      {...resto}
    >
      {children}
    </Link>
  );
}

/**
 * Classes de campo de formulário — input e select.
 *
 * Compartilham o mesmo raio dos botões: é o que evita o campo quadrado
 * encostado no botão redondo que motivou esta extração.
 */
export function classesDeCampo(extra = ""): string {
  return [
    "rounded-controle border border-neutral-300 bg-white px-4 py-3 text-tinta",
    "focus:border-marca focus:outline-none disabled:opacity-50",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}
