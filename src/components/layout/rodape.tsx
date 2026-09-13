import Link from "next/link";

const NAVEGACAO = [
  { href: "/pneus", rotulo: "Pneus" },
  { href: "/servicos", rotulo: "Serviços" },
  { href: "/quem-somos", rotulo: "Quem somos" },
];

export function Rodape() {
  return (
    <footer className="mt-24 bg-tinta">
      <div className="h-1 bg-marca" />

      <div className="mx-auto max-w-7xl px-4 py-14">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="max-w-sm">
            <p className="text-2xl font-black uppercase italic tracking-tight text-white">
              Zé<span className="text-marca">Pneu</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-tinta-clara">
              Pneus e acessórios com entrega em todo o Brasil e retirada em
              Brasília.
            </p>
          </div>

          <nav>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              Navegação
            </h2>
            <ul className="mt-4 space-y-2.5">
              {NAVEGACAO.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-tinta-clara transition hover:text-white"
                  >
                    {item.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-14 border-t border-neutral-800 pt-8 text-xs text-tinta-clara">
          © {new Date().getFullYear()} Zé Pneu. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
