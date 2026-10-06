"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemDeNavegacao = { href: string; rotulo: string };

/**
 * Menu do painel. No celular vira uma faixa rolável no topo: a operação
 * confere pedido pelo telefone, no balcão.
 */
export function NavegacaoDoPainel({ itens }: { itens: ItemDeNavegacao[] }) {
  const atual = usePathname();
  const ativo = (href: string) => (href === "/admin" ? atual === "/admin" : atual.startsWith(href));

  return (
    <nav aria-label="Painel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {itens.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={ativo(item.href) ? "page" : undefined}
              className={`block whitespace-nowrap rounded-controle px-3 py-2 text-sm font-bold uppercase tracking-wide transition ${
                ativo(item.href) ? "bg-marca text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
