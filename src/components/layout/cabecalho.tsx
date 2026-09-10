import Link from "next/link";
import { Busca } from "@/components/catalogo/busca";
import { WhatsAppLink } from "@/components/whatsapp-link";

export function Cabecalho() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
        <Link href="/" className="text-xl font-bold text-neutral-900">
          Zé Pneu
        </Link>
        <div className="order-3 w-full md:order-none md:flex-1">
          <Busca />
        </div>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link
            href="/pneus"
            className="text-neutral-700 hover:text-neutral-900"
          >
            Pneus
          </Link>
          <WhatsAppLink
            mensagem="Olá! Vim pelo site do Zé Pneu."
            className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
          >
            WhatsApp
          </WhatsAppLink>
        </nav>
      </div>
    </header>
  );
}
