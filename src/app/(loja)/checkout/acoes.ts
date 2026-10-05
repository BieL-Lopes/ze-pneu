"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCheckoutService } from "@/lib/container";
import { tokenDoCarrinho } from "@/lib/cart-cookie";
import { normalizarCep } from "@/core/shipping/cep";
import { normalizarCpf } from "@/core/orders/cpf";
import type { OpcaoDeFrete } from "@/core/shipping/shipping-provider";
import type { EntradaDoCheckout } from "@/core/orders/checkout-service";
import { buscarCep, type EnderecoDoCep } from "@/integrations/viacep";

export type ResultadoDaCotacao =
  | { ok: true; endereco: EnderecoDoCep | null; opcoes: OpcaoDeFrete[] }
  | { ok: false; erro: string };

export async function cotarFrete(cepDigitado: string): Promise<ResultadoDaCotacao> {
  const cep = normalizarCep(cepDigitado);
  if (!cep) return { ok: false, erro: "CEP inválido. Confira os 8 dígitos." };

  try {
    const checkout = await getCheckoutService();
    const [endereco, cotacao] = await Promise.all([
      buscarCep(cep),
      checkout.cotarFrete(await tokenDoCarrinho(), cep),
    ]);
    if (!cotacao.ok) return { ok: false, erro: cotacao.error };
    return { ok: true, endereco, opcoes: cotacao.value };
  } catch (e) {
    console.error("Falha ao cotar frete", e);
    return { ok: false, erro: "Não conseguimos cotar a entrega agora. Tente de novo em instantes." };
  }
}

const texto = (min: number, max: number, rotulo: string) =>
  z
    .string()
    .trim()
    .min(min, `Preencha ${rotulo}.`)
    .max(max, `${rotulo[0].toUpperCase()}${rotulo.slice(1)} muito longo.`);

const comprador = z.object({
  nome: texto(3, 120, "o nome completo"),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  telefone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""))
    .refine((v) => /^\d{10,11}$/.test(v), "WhatsApp inválido. Use DDD + número."),
  cpf: z
    .string()
    .transform((v) => normalizarCpf(v))
    .refine((v): v is string => v !== null, "CPF inválido."),
});

const entrega = z.object({
  cep: z
    .string()
    .transform((v) => normalizarCep(v))
    .refine((v): v is string => v !== null, "CEP inválido."),
  rua: texto(2, 150, "a rua"),
  numero: texto(1, 20, "o número"),
  complemento: z
    .string()
    .trim()
    .max(80, "Complemento muito longo.")
    .transform((v) => (v === "" ? null : v)),
  bairro: texto(2, 80, "o bairro"),
  cidade: texto(2, 80, "a cidade"),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF inválida."),
  servicoId: z.string().trim().min(1, "Escolha uma opção de entrega."),
});

export type EstadoDoCheckout = { erro: string | null };

export async function finalizarCompra(
  _anterior: EstadoDoCheckout,
  dados: FormData,
): Promise<EstadoDoCheckout> {
  const campo = (nome: string) => String(dados.get(nome) ?? "");

  const pessoa = comprador.safeParse({
    nome: campo("nome"),
    email: campo("email"),
    telefone: campo("telefone"),
    cpf: campo("cpf"),
  });
  if (!pessoa.success) return { erro: pessoa.error.issues[0].message };

  let entrada: EntradaDoCheckout;
  if (campo("recebimento") === "entrega") {
    const destino = entrega.safeParse({
      cep: campo("cep"),
      rua: campo("rua"),
      numero: campo("numero"),
      complemento: campo("complemento"),
      bairro: campo("bairro"),
      cidade: campo("cidade"),
      uf: campo("uf"),
      servicoId: campo("servicoId"),
    });
    if (!destino.success) return { erro: destino.error.issues[0].message };
    const { servicoId, ...endereco } = destino.data;
    entrada = { comprador: pessoa.data, recebimento: { tipo: "entrega", endereco, servicoId } };
  } else {
    entrada = { comprador: pessoa.data, recebimento: { tipo: "retirada" } };
  }

  let destinoDoPagamento: string;
  try {
    const checkout = await getCheckoutService();
    const r = await checkout.finalizar(await tokenDoCarrinho(), entrada);
    if (!r.ok) return { erro: r.error };
    destinoDoPagamento = r.value.urlPagamento;
  } catch (e) {
    console.error("Falha ao finalizar a compra", e);
    return { erro: "Não foi possível fechar o pedido agora. Tente de novo em instantes." };
  }

  // Fora do try: o redirect do Next funciona lançando um sinal especial.
  redirect(destinoDoPagamento);
}
