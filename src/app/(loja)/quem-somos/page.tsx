import type { Metadata } from "next";
import { FaixaTitulo } from "@/components/layout/faixa-titulo";

export const metadata: Metadata = {
  title: "Quem somos",
  description:
    "O Zé Pneu é uma plataforma automotiva que une tecnologia, e-commerce e serviços móveis para levar soluções completas até o motorista brasileiro.",
};

// Texto do material institucional do cliente, usado sem reescrita.
const VISAO = [
  "Excelência na experiência do cliente",
  "Eficiência operacional em larga escala",
  "Forte presença de marca em todo o território brasileiro",
  "Uso inteligente de tecnologia para conectar produtos, serviços e pessoas",
];

const VALORES = [
  {
    nome: "Cliente no centro",
    texto:
      "Resolvemos problemas reais do dia a dia do motorista, respeitando seu tempo, sua segurança e sua confiança.",
  },
  {
    nome: "Conveniência total",
    texto: "Seja um serviço automotivo ou um motorista, a solução vai até o cliente.",
  },
  {
    nome: "Segurança em primeiro lugar",
    texto:
      "Segurança viária, responsabilidade e cuidado com pessoas são princípios inegociáveis.",
  },
  {
    nome: "Transparência e confiança",
    texto:
      "Preço claro, serviço explicado, profissionais qualificados e comunicação direta.",
  },
  {
    nome: "Excelência operacional",
    texto:
      "Padrões técnicos elevados, processos bem definidos e controle de qualidade contínuo.",
  },
  {
    nome: "Inovação aplicada",
    texto:
      "Tecnologia usada para resolver problemas reais, gerar eficiência e escala.",
  },
  {
    nome: "Crescimento sustentável",
    texto:
      "Expansão estruturada, com impacto positivo para clientes, parceiros e a sociedade.",
  },
];

export default function QuemSomosPage() {
  return (
    <main>
      <FaixaTitulo
        titulo="Quem somos"
        apoio="Somos uma plataforma automotiva que une tecnologia, e-commerce e serviços móveis para levar soluções completas até o motorista brasileiro, onde quer que ele esteja."
      />

      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="max-w-[68ch] space-y-6 text-lg leading-relaxed text-tinta-media">
          <p>
            Acreditamos que cuidar do carro não precisa ser complicado, demorado
            ou estressante. Por isso, criamos um ecossistema que conecta compra
            de produtos, agendamento de serviços e atendimento móvel em um único
            fluxo simples e eficiente.
          </p>
          <p className="font-semibold text-tinta">
            Do clique no aplicativo à van estacionando no local do atendimento,
            nossa missão é resolver.
          </p>
        </div>

        <div className="mt-20 grid gap-12 border-t border-neutral-200 pt-12 md:grid-cols-2">
          <section>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-tinta">
              Propósito
            </h2>
            <p className="mt-4 leading-relaxed text-tinta-media">
              Existimos para simplificar a relação das pessoas com seus carros,
              oferecendo conveniência, confiança e atendimento rápido em
              qualquer lugar do Brasil. Com uma solução totalmente inovadora no
              mercado.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-tinta">
              Missão
            </h2>
            <p className="mt-4 leading-relaxed text-tinta-media">
              Oferecer pneus, acessórios e serviços automotivos por meio de uma
              plataforma integrada e escalável, que combina e-commerce,
              aplicativo e atendimento móvel, levando praticidade, qualidade e
              transparência ao cliente final.
            </p>
          </section>
        </div>

        <section className="mt-20 border-t border-neutral-200 pt-12">
          <h2 className="text-2xl font-black uppercase italic tracking-tight text-tinta">
            Visão
          </h2>
          <p className="mt-4 max-w-[60ch] text-lg font-semibold text-tinta">
            Ser a principal referência nacional em serviços automotivos móveis,
            reconhecida por:
          </p>
          <ul className="mt-6 max-w-[68ch]">
            {VISAO.map((item) => (
              <li
                key={item}
                className="border-b border-neutral-200 py-4 text-tinta-media last:border-b-0"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 border-t border-neutral-200 pt-12">
          <h2 className="text-2xl font-black uppercase italic tracking-tight text-tinta">
            Valores
          </h2>
          <dl className="mt-8 grid gap-x-12 md:grid-cols-2">
            {VALORES.map((valor) => (
              <div
                key={valor.nome}
                className="border-b border-neutral-200 py-6"
              >
                <dt className="font-bold uppercase tracking-wide text-marca">
                  {valor.nome}
                </dt>
                <dd className="mt-2 leading-relaxed text-tinta-media">
                  {valor.texto}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
