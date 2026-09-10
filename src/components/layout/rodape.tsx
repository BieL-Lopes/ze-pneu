export function Rodape() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-900">Zé Pneu</p>
        <p className="mt-1">
          Pneus e acessórios com entrega em todo o Brasil e retirada em
          Brasília.
        </p>
        <p className="mt-4 text-xs text-neutral-500">
          © {new Date().getFullYear()} Zé Pneu. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
