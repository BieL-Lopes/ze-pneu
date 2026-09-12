import Link from "next/link";
import { Busca } from "@/components/catalogo/busca";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { IconeWhatsApp } from "@/components/icones";

export function Cabecalho() {
  return (
    <header className="bg-tinta">
      {/* Fio vermelho no topo: a marca aparece antes de qualquer conteúdo. */}
      <div className="h-1 bg-marca" />

      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
        <Link
          href="/"
          className="text-2xl font-black tracking-tight text-white uppercase italic"
        >
          Zé<span className="text-marca">Pneu</span>
        </Link>

        <div className="order-3 w-full md:order-none md:flex-1">
          <Busca />
        </div>

        <nav className="ml-auto flex items-center gap-5 text-sm">
          <Link
            href="/pneus"
            className="font-semibold text-white transition hover:text-marca"
          >
            Pneus
          </Link>
          <WhatsAppLink
            mensagem="Olá! Vim pelo site do Zé Pneu."
            className="flex items-center gap-2 rounded-md bg-marca px-4 py-2 font-bold text-white transition hover:bg-marca-escura"
          >
            <IconeWhatsApp className="h-4 w-4" />
            WhatsApp
          </WhatsAppLink>
        </nav>
      </div>
    </header>
  );
}
