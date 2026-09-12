export function Rodape() {
  return (
    <footer className="mt-20 bg-tinta">
      <div className="h-1 bg-marca" />

      <div className="mx-auto max-w-7xl px-4 py-12">
        <p className="text-2xl font-black uppercase italic tracking-tight text-white">
          Zé<span className="text-marca">Pneu</span>
        </p>
        <p className="mt-3 max-w-md text-sm text-tinta-clara">
          Pneus e acessórios com entrega em todo o Brasil e retirada em
          Brasília.
        </p>
        <p className="mt-8 text-xs text-tinta-clara">
          © {new Date().getFullYear()} Zé Pneu. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
