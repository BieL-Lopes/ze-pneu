/**
 * Faixa vermelha de abertura das páginas internas.
 *
 * Sobre o vermelho da marca só branco puro atinge 4,5:1, então a linha de apoio
 * também é branca e a hierarquia vem de tamanho e peso.
 */
export function FaixaTitulo({
  titulo,
  apoio,
}: {
  titulo: string;
  apoio?: string;
}) {
  return (
    <section className="bg-marca">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <h1 className="text-balance text-4xl font-black uppercase italic leading-[1.04] tracking-tight text-white sm:text-6xl sm:leading-[0.98]">
          {titulo}
        </h1>
        {apoio && (
          <p className="mt-6 max-w-2xl text-lg font-medium text-white">
            {apoio}
          </p>
        )}
      </div>
    </section>
  );
}
