import { BotaoLink } from "@/components/ui/botao";

/**
 * Ponte para a página de serviços.
 *
 * Fala do que vem, sem prometer atendimento que a operação ainda não faz — o
 * texto diz "em breve" e o destino é a página onde cada serviço está marcado
 * como tal.
 */
export function ChamadaServicos() {
  return (
    <section className="border-t border-neutral-200 py-16">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black uppercase italic tracking-tight text-tinta">
            O Zé vai até você
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-tinta-media">
            Estamos montando o atendimento móvel do Zé Pneu: troca de pneu,
            troca de óleo, bateria e manutenção rápida no lugar onde o carro
            estiver. Ainda não está no ar — veja o que vem e avise que tem
            interesse.
          </p>
        </div>

        <BotaoLink
          href="/servicos"
          variante="contorno"
          tamanho="grande"
          className="shrink-0 border-2"
        >
          Ver os serviços
        </BotaoLink>
      </div>
    </section>
  );
}
