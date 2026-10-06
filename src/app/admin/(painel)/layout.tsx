import Link from "next/link";
import { exigirUsuario } from "@/lib/sessao-admin";
import { podeAcessar, ROTULO_PAPEL, type Area } from "@/core/admin/papeis";
import { NavegacaoDoPainel, type ItemDeNavegacao } from "@/components/painel/navegacao";
import { acaoSair } from "./acoes";

const MENU: (ItemDeNavegacao & { area?: Area })[] = [
  { href: "/admin", rotulo: "Resumo" },
  { href: "/admin/pedidos", rotulo: "Pedidos", area: "pedidos" },
  { href: "/admin/estoque", rotulo: "Estoque", area: "estoque" },
  { href: "/admin/produtos", rotulo: "Produtos", area: "produtos" },
  { href: "/admin/configuracoes", rotulo: "Frete e loja", area: "configuracoes" },
  { href: "/admin/usuarios", rotulo: "Usuários", area: "usuarios" },
];

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const itens = MENU.filter((i) => !i.area || podeAcessar(usuario.papel, i.area)).map(({ href, rotulo }) => ({
    href,
    rotulo,
  }));

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="bg-tinta lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col">
        <div className="h-1 bg-marca" />
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <Link href="/admin" className="text-2xl font-black uppercase italic tracking-tight text-white">
            Zé<span className="text-marca">Pneu</span>
          </Link>
          <Link href="/" className="text-xs font-semibold text-tinta-clara hover:text-white lg:mt-1 lg:block">
            Ver a loja ↗
          </Link>
        </div>
        <div className="px-4 pb-3 lg:flex-1 lg:pb-0">
          <NavegacaoDoPainel itens={itens} />
        </div>
        <div className="hidden border-t border-white/10 px-4 py-4 text-sm lg:block">
          <Link href="/admin/conta" className="block font-bold text-white hover:text-marca">
            {usuario.nome}
          </Link>
          <p className="text-xs text-tinta-clara">{ROTULO_PAPEL[usuario.papel]}</p>
          <form action={acaoSair} className="mt-3">
            <button type="submit" className="text-xs font-bold uppercase tracking-wide text-tinta-clara hover:text-white">
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 text-sm lg:hidden">
          <Link href="/admin/conta" className="font-bold text-tinta">
            {usuario.nome}
          </Link>
          <form action={acaoSair}>
            <button type="submit" className="text-xs font-bold uppercase tracking-wide text-tinta-media">
              Sair
            </button>
          </form>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
