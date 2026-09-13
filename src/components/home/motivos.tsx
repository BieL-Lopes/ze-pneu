const MOTIVOS = [
  {
    titulo: "Entrega em todo o Brasil",
    texto:
      "Seu pneu sai de Brasília e chega na sua casa, com prazo e valor de frete calculados antes de você fechar a compra.",
  },
  {
    titulo: "Retire em Brasília",
    texto:
      "Está na cidade? Compre pelo site e retire no local, sem pagar frete e sem esperar transportadora.",
  },
  {
    titulo: "Dúvida antes de comprar",
    texto:
      "Não sabe qual medida serve no seu carro? Chame no WhatsApp que a gente confere com você.",
  },
];

/**
 * Faixa de motivos.
 *
 * Em texto corrido sobre fundo escuro, não em três cartões com ícone: o cartão
 * com ícone e título curto vira decoração e a pessoa pula. Aqui cada motivo
 * responde a uma dúvida real de quem está decidindo.
 */
export function Motivos() {
  return (
    <section className="bg-tinta">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-3">
        {MOTIVOS.map((motivo) => (
          <div key={motivo.titulo}>
            <h3 className="text-lg font-black uppercase italic tracking-tight text-white">
              {motivo.titulo}
            </h3>
            <p className="mt-3 leading-relaxed text-tinta-clara">
              {motivo.texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
