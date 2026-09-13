import type { Metadata } from "next";
import { FaixaTitulo } from "@/components/layout/faixa-titulo";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { IconeWhatsApp } from "@/components/icones";
import { BotaoLink, classesDeBotao } from "@/components/ui/botao";

export const metadata: Metadata = {
  title: "Serviços",
  description:
    "E-commerce de pneus e acessórios disponível agora. Serviços automotivos móveis, motorista responsável, botão de emergência e assinatura em breve.",
};

/**
 * Serviços em desenvolvimento.
 *
 * O selo de "Em breve" é deliberadamente grande e aparece antes da descrição:
 * a operação ainda não atende esses pedidos, e um cliente que tenta contratar
 * e não é atendido custa mais caro do que a página inteira vale.
 */
const EM_BREVE = [
  {
    nome: "Serviços automotivos móveis",
    texto:
      "Troca de pneus, troca de óleo, bateria, estética automotiva e manutenção rápida, realizados por vans equipadas e padronizadas, no local onde você estiver.",
    interesse: "Olá! Quero saber quando os serviços móveis do Zé Pneu vão lançar.",
  },
  {
    nome: "Motorista responsável",
    texto:
      "Quando você não pode ou não deve dirigir, o Zé dirige por você. Um motorista profissional e treinado vai até onde você estiver e conduz o seu próprio veículo com segurança até sua casa.",
    interesse:
      "Olá! Quero saber quando o Motorista Responsável do Zé Pneu vai lançar.",
  },
  {
    nome: "Botão de emergência",
    texto:
      "Apoio rápido em pane mecânica, pneu furado, falta de bateria, mal-estar ao volante ou situação de insegurança. O sistema identifica sua localização e envia o suporte mais adequado.",
    interesse:
      "Olá! Quero saber quando o Botão de Emergência do Zé Pneu vai lançar.",
  },
  {
    nome: "Planos de assinatura",
    texto:
      "Manutenção do seu carro em um plano mensal, com serviços recorrentes e atendimento prioritário.",
    interesse: "Olá! Quero saber sobre os planos de assinatura do Zé Pneu.",
  },
  {
    nome: "Aplicativo Zé Pneu",
    texto:
      "Comprar pneus, agendar serviço no local onde você estiver e acompanhar o atendimento em tempo real, tudo em um aplicativo.",
    interesse: "Olá! Quero saber quando o aplicativo do Zé Pneu vai lançar.",
  },
];

export default function ServicosPage() {
  return (
    <main>
      <FaixaTitulo
        titulo="Serviços"
        apoio="Uma plataforma completa que integra e-commerce automotivo, serviços automotivos móveis e soluções de mobilidade segura — com atendimento profissional, onde o cliente estiver."
      />

      <div className="mx-auto max-w-5xl px-4 py-16">
        <section className="border-t-4 border-marca pt-8">
          <span className="inline-block rounded-controle bg-marca px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
            Disponível agora
          </span>
          <h2 className="mt-5 text-3xl font-black uppercase italic tracking-tight text-tinta sm:text-4xl">
            E-commerce automotivo
          </h2>
          <p className="mt-4 max-w-[68ch] text-lg leading-relaxed text-tinta-media">
            Venda de pneus, acessórios e itens de manutenção com alcance
            nacional. Encontre a medida certa, compare marcas e preços, e receba
            em casa — ou retire em Brasília.
          </p>
          <BotaoLink href="/pneus" tamanho="grande" className="mt-8">
            Ver pneus
          </BotaoLink>
        </section>

        <section className="mt-24">
          <h2 className="text-3xl font-black uppercase italic tracking-tight text-tinta">
            Em desenvolvimento
          </h2>
          <p className="mt-3 max-w-[68ch] text-tinta-media">
            Estes serviços ainda não estão em operação. Avise que tem interesse e
            a gente chama você assim que lançar.
          </p>

          <ul className="mt-10">
            {EM_BREVE.map((servico) => (
              <li
                key={servico.nome}
                className="border-t border-neutral-200 py-10"
              >
                <span className="inline-block rounded-controle border border-tinta px-3 py-1 text-xs font-bold uppercase tracking-widest text-tinta">
                  Em breve
                </span>
                <h3 className="mt-5 text-2xl font-black uppercase italic tracking-tight text-tinta">
                  {servico.nome}
                </h3>
                <p className="mt-3 max-w-[68ch] leading-relaxed text-tinta-media">
                  {servico.texto}
                </p>
                <WhatsAppLink
                  mensagem={servico.interesse}
                  className={classesDeBotao({ variante: "contorno", extra: "mt-6" })}
                >
                  <IconeWhatsApp className="h-4 w-4" />
                  Quero saber quando lançar
                </WhatsAppLink>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-24 bg-tinta p-10 sm:p-14">
          <span className="inline-block rounded-controle border border-white px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
            Em breve
          </span>
          <h2 className="mt-5 text-3xl font-black uppercase italic tracking-tight text-white">
            Seja um franqueado
          </h2>
          <p className="mt-4 max-w-[62ch] leading-relaxed text-tinta-clara">
            O franqueado Zé Pneu opera dentro de uma plataforma nacional, com
            tecnologia, marketing e geração de demanda centralizados — com foco
            total na execução e na qualidade do serviço na sua região.
          </p>
          <WhatsAppLink
            mensagem="Olá! Tenho interesse em ser franqueado do Zé Pneu."
            className={classesDeBotao({ tamanho: "grande", extra: "mt-8" })}
          >
            <IconeWhatsApp className="h-5 w-5" />
            Quero ser franqueado
          </WhatsAppLink>
        </section>
      </div>
    </main>
  );
}
