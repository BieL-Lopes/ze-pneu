import Link from "next/link";
import { Busca } from "@/components/catalogo/busca";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { IconeWhatsApp } from "@/components/icones";
import { IconeCarrinho } from "@/components/icones-carrinho";

const LINKS = [
  { href: "/pneus", rotulo: "Pneus" },
  { href: "/servicos", rotulo: "Serviços" },
  { href: "/quem-somos", rotulo: "Quem somos" },
];

export function Cabecalho() {
  return (
    <header className="bg-tinta">
      {/* Fio vermelho no topo: a marca aparece antes de qualquer conteúdo. */}
      <div className="h-1 bg-marca" />

      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-4 px-4 py-4">
        <Link
          href="/"
          className="text-2xl font-black uppercase italic tracking-tight text-white"
        >
          Zé<span className="text-marca">Pneu</span>
        </Link>

        <div className="order-last w-full md:order-none md:w-auto md:flex-1">
          <Busca />
        </div>

        <nav className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-3 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-semibold whitespace-nowrap text-white transition hover:text-marca"
            >
              {link.rotulo}
            </Link>
          ))}
          <Link
            href="/carrinho"
            aria-label="Ver carrinho"
            className="text-white transition hover:text-marca"
          >
            <IconeCarrinho className="h-6 w-6" />
          </Link>
          <WhatsAppLink
            mensagem="Olá! Vim pelo site do Zé Pneu."
            className="flex items-center gap-2 rounded-md bg-marca px-4 py-2 font-bold whitespace-nowrap text-white transition hover:bg-marca-escura"
          >
            <IconeWhatsApp className="h-4 w-4" />
            WhatsApp
          </WhatsAppLink>
        </nav>
      </div>
    </header>
  );
}
