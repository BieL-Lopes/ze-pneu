import { Cabecalho } from "@/components/layout/cabecalho";
import { Rodape } from "@/components/layout/rodape";

/** Moldura da loja. O painel administrativo tem a sua, sem busca nem carrinho. */
export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Cabecalho />
      <div className="flex-1">{children}</div>
      <Rodape />
    </>
  );
}
