"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import {
  cotarFrete,
  finalizarCompra,
  type EstadoDoCheckout,
} from "@/app/(loja)/checkout/acoes";
import type { OpcaoDeFrete } from "@/core/shipping/shipping-provider";
import { formatBRL } from "@/lib/format";
import { Botao, classesDeCampo } from "@/components/ui/botao";

export type ItemDoResumo = {
  variantId: string;
  nome: string;
  medida: string | null;
  quantidade: number;
  subtotalCents: number;
};

type Props = {
  itens: ItemDoResumo[];
  subtotalCents: number;
  retirada: { endereco: string | null; horario: string | null };
  entregaDisponivel: boolean;
  pagamentoDisponivel: boolean;
  avisoSemPagamento: ReactNode;
};

const ESTADO_INICIAL: EstadoDoCheckout = { erro: null };

function prazo(dias: number): string {
  if (dias <= 0) return "prazo informado na confirmação";
  return dias === 1 ? "1 dia útil" : `${dias} dias úteis`;
}

function Campo({
  rotulo,
  className = "",
  ...input
}: { rotulo: string; className?: string } & React.ComponentProps<"input">) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-tinta-media">
        {rotulo}
      </span>
      <input {...input} className={classesDeCampo("w-full")} />
    </label>
  );
}

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <fieldset className="border-t-4 border-tinta pt-6">
      <legend className="float-left mb-6 flex w-full items-baseline gap-3">
        <span className="numerais-tabulares text-sm font-black text-marca">0{numero}</span>
        <span className="text-xl font-black uppercase italic tracking-tight text-tinta">{titulo}</span>
      </legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

export function FormularioCheckout({
  itens,
  subtotalCents,
  retirada,
  entregaDisponivel,
  pagamentoDisponivel,
  avisoSemPagamento,
}: Props) {
  const [estado, enviar, enviando] = useActionState(finalizarCompra, ESTADO_INICIAL);

  // Todos os campos são controlados: o React limpa campo não controlado depois
  // que a ação do formulário termina, e o cliente perderia o que digitou
  // quando o servidor devolve um erro de validação.
  const [dados, setDados] = useState({ nome: "", email: "", telefone: "", cpf: "", numero: "", complemento: "" });
  const campo = (nome: keyof typeof dados) => ({
    name: nome,
    value: dados[nome],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDados({ ...dados, [nome]: e.target.value }),
  });

  const [recebimento, setRecebimento] = useState<"retirada" | "entrega">("retirada");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState({ rua: "", bairro: "", cidade: "", uf: "" });
  const [opcoes, setOpcoes] = useState<OpcaoDeFrete[] | null>(null);
  const [servicoId, setServicoId] = useState("");
  const [erroFrete, setErroFrete] = useState<string | null>(null);
  const [cotando, iniciarCotacao] = useTransition();

  const escolhida = opcoes?.find((o) => o.id === servicoId) ?? null;
  const freteCents = recebimento === "entrega" ? (escolhida?.precoCents ?? 0) : 0;
  const prontoParaPagar =
    pagamentoDisponivel && (recebimento === "retirada" || escolhida !== null);

  function calcular() {
    setErroFrete(null);
    iniciarCotacao(async () => {
      const r = await cotarFrete(cep);
      if (!r.ok) {
        setOpcoes(null);
        setServicoId("");
        setErroFrete(r.erro);
        return;
      }
      if (r.endereco) setEndereco(r.endereco);
      setOpcoes(r.opcoes);
      setServicoId(r.opcoes[0]?.id ?? "");
    });
  }

  function mudarCep(valor: string) {
    setCep(valor);
    // Cotação de outro CEP não vale para este.
    setOpcoes(null);
    setServicoId("");
  }

  return (
    <form action={enviar} className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
      <div className="space-y-12">
        <Secao numero={1} titulo="Seus dados">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo" {...campo("nome")} autoComplete="name" required minLength={3} className="sm:col-span-2" />
            <Campo rotulo="E-mail" {...campo("email")} type="email" autoComplete="email" required />
            <Campo rotulo="WhatsApp" {...campo("telefone")} type="tel" autoComplete="tel-national" inputMode="tel" placeholder="(61) 99999-9999" required />
            <Campo rotulo="CPF" {...campo("cpf")} inputMode="numeric" placeholder="000.000.000-00" required />
          </div>
          <p className="mt-3 text-sm text-tinta-media">
            O CPF vai na nota fiscal. Avisamos o andamento do pedido pelo WhatsApp e por e-mail.
          </p>
        </Secao>

        <Secao numero={2} titulo="Recebimento">
          <input type="hidden" name="recebimento" value={recebimento} />
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Forma de recebimento">
            <OpcaoDeRecebimento
              marcada={recebimento === "retirada"}
              onEscolher={() => setRecebimento("retirada")}
              titulo="Retirar em Brasília"
              detalhe="Grátis"
            />
            <OpcaoDeRecebimento
              marcada={recebimento === "entrega"}
              onEscolher={() => setRecebimento("entrega")}
              titulo="Receber em casa"
              detalhe={entregaDisponivel ? "Calcule pelo CEP" : "Indisponível no momento"}
              desabilitada={!entregaDisponivel}
            />
          </div>

          {recebimento === "retirada" && (
            <div className="mt-6 rounded-controle bg-neutral-100 p-5 text-sm text-tinta">
              <p className="font-bold">{retirada.endereco ?? "Loja Zé Pneu em Brasília"}</p>
              <p className="mt-1 text-tinta-media">
                {retirada.horario ??
                  "Combinamos o horário da retirada pelo WhatsApp assim que o pagamento for confirmado."}
              </p>
              <p className="mt-3 text-tinta-media">
                Leve um documento com foto. O pneu fica separado no seu nome a partir da confirmação do pagamento.
              </p>
            </div>
          )}

          {recebimento === "entrega" && (
            <div className="mt-6 space-y-6">
              <div className="flex items-end gap-3">
                <Campo
                  rotulo="CEP"
                  name="cep"
                  value={cep}
                  onChange={(e) => mudarCep(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      calcular();
                    }
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  required
                  className="flex-1"
                />
                <Botao variante="contorno" onClick={calcular} disabled={cotando} className="py-3">
                  {cotando ? "Calculando..." : "Calcular"}
                </Botao>
              </div>

              {erroFrete && (
                <p role="alert" className="text-sm font-semibold text-marca">
                  {erroFrete}
                </p>
              )}

              {opcoes && (
                <>
                  <fieldset>
                    <legend className="mb-2 text-xs font-bold uppercase tracking-widest text-tinta-media">
                      Opções de entrega
                    </legend>
                    <ul className="divide-y divide-neutral-200 rounded-controle border border-neutral-300">
                      {opcoes.map((o) => (
                        <li key={o.id}>
                          <label className="flex cursor-pointer items-center gap-4 p-4 has-[:checked]:bg-neutral-50">
                            <input
                              type="radio"
                              name="servicoId"
                              value={o.id}
                              checked={servicoId === o.id}
                              onChange={() => setServicoId(o.id)}
                              className="h-4 w-4 accent-marca"
                            />
                            <span className="flex-1">
                              <span className="block font-bold text-tinta">
                                {o.transportadora} · {o.servico}
                              </span>
                              <span className="block text-sm text-tinta-media">{prazo(o.prazoDias)}</span>
                            </span>
                            <span className="numerais-tabulares font-black text-tinta">{formatBRL(o.precoCents)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>

                  <div className="grid gap-4 sm:grid-cols-6">
                    <Campo rotulo="Rua" name="rua" value={endereco.rua} onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })} autoComplete="address-line1" required className="sm:col-span-4" />
                    <Campo rotulo="Número" {...campo("numero")} autoComplete="address-line2" required className="sm:col-span-2" />
                    <Campo rotulo="Complemento" {...campo("complemento")} placeholder="Apto, bloco, referência" className="sm:col-span-3" />
                    <Campo rotulo="Bairro" name="bairro" value={endereco.bairro} onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })} required className="sm:col-span-3" />
                    <Campo rotulo="Cidade" name="cidade" value={endereco.cidade} onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })} autoComplete="address-level2" required className="sm:col-span-4" />
                    <Campo rotulo="UF" name="uf" value={endereco.uf} onChange={(e) => setEndereco({ ...endereco, uf: e.target.value })} autoComplete="address-level1" maxLength={2} required className="sm:col-span-2" />
                  </div>
                </>
              )}
            </div>
          )}
        </Secao>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="border-t-4 border-tinta pt-6">
          <h2 className="text-xl font-black uppercase italic tracking-tight text-tinta">Resumo</h2>

          <ul className="mt-4 divide-y divide-neutral-200">
            {itens.map((i) => (
              <li key={i.variantId} className="flex justify-between gap-4 py-3 text-sm">
                <span>
                  <span className="block font-bold text-tinta">
                    {i.quantidade}× {i.nome}
                  </span>
                  {i.medida && <span className="numerais-tabulares block text-tinta-media">{i.medida}</span>}
                </span>
                <span className="numerais-tabulares font-bold text-tinta">{formatBRL(i.subtotalCents)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-media">Produtos</dt>
              <dd className="numerais-tabulares text-tinta">{formatBRL(subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-media">{recebimento === "retirada" ? "Retirada" : "Frete"}</dt>
              <dd className="numerais-tabulares text-tinta">
                {recebimento === "retirada" ? "Grátis" : escolhida ? formatBRL(freteCents) : "Informe o CEP"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3">
              <dt className="text-sm font-bold uppercase tracking-widest text-tinta-media">Total</dt>
              <dd className="numerais-tabulares text-3xl font-black text-tinta">
                {formatBRL(subtotalCents + freteCents)}
              </dd>
            </div>
          </dl>

          {estado.erro && (
            <p role="alert" className="mt-6 border border-marca p-4 text-sm font-semibold text-marca">
              {estado.erro}
            </p>
          )}

          {pagamentoDisponivel ? (
            <>
              <Botao type="submit" tamanho="grande" larguraTotal disabled={!prontoParaPagar || enviando} className="mt-6">
                {enviando ? "Abrindo pagamento..." : "Pagar com Mercado Pago"}
              </Botao>
              <p className="mt-3 text-center text-xs text-tinta-media">
                Pix ou cartão em até 12x. Você paga no Mercado Pago e volta para acompanhar o pedido.
              </p>
            </>
          ) : (
            <div className="mt-6">{avisoSemPagamento}</div>
          )}
        </div>
      </aside>
    </form>
  );
}

function OpcaoDeRecebimento({
  marcada,
  onEscolher,
  titulo,
  detalhe,
  desabilitada = false,
}: {
  marcada: boolean;
  onEscolher: () => void;
  titulo: string;
  detalhe: string;
  desabilitada?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      disabled={desabilitada}
      onClick={onEscolher}
      className={[
        "rounded-controle border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
        marcada ? "border-marca" : "border-neutral-300 hover:border-tinta",
      ].join(" ")}
    >
      <span className="block font-black uppercase tracking-tight text-tinta">{titulo}</span>
      <span className={`mt-1 block text-sm ${marcada ? "font-semibold text-marca" : "text-tinta-media"}`}>
        {detalhe}
      </span>
    </button>
  );
}
