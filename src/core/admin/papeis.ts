/**
 * Papéis do painel.
 *
 * O operador cuida do dia a dia da loja — pedidos e estoque. Mexer em preço,
 * catálogo, regra de frete e em quem tem acesso fica com o admin: são as
 * mudanças que alteram quanto a loja cobra ou quem pode mexer nela.
 */
export const PAPEIS = ["admin", "operador"] as const;
export type Papel = (typeof PAPEIS)[number];

export type Area = "pedidos" | "estoque" | "produtos" | "configuracoes" | "usuarios";

const PERMISSOES: Record<Papel, Area[]> = {
  admin: ["pedidos", "estoque", "produtos", "configuracoes", "usuarios"],
  operador: ["pedidos", "estoque"],
};

export function podeAcessar(papel: Papel, area: Area): boolean {
  return PERMISSOES[papel].includes(area);
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  operador: "Operador",
};
