"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/sessao-admin";
import { gravarConfiguracoes } from "@/db/consultas-do-painel";
import { precoParaCentavos } from "@/core/catalog/csv-import";
import type { EstadoDaAcao } from "@/components/painel/estado-da-acao";

function campo(dados: FormData, nome: string, max = 300): string {
  return String(dados.get(nome) ?? "").trim().slice(0, max);
}

async function salvar(valores: { chave: string; valor: string; ligada: boolean }[]): Promise<EstadoDaAcao> {
  try {
    await gravarConfiguracoes(valores);
  } catch (e) {
    console.error("Falha ao gravar configurações", e);
    return { ok: false, mensagem: "Não foi possível salvar agora. Tente de novo." };
  }
  // Faixa, retirada e frete aparecem em páginas da loja que ficam em cache.
  revalidatePath("/", "layout");
  return { ok: true, mensagem: "Salvo. A loja já usa os novos valores." };
}

export async function acaoSalvarFrete(_a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  await exigirUsuario("configuracoes");

  const dias = campo(dados, "prazoManuseio", 3) || "0";
  if (!/^\d{1,2}$/.test(dias)) return { ok: false, mensagem: "Prazo de manuseio: informe dias inteiros, de 0 a 99." };

  const gratisLigado = dados.get("freteGratisLigado") === "on";
  const limiteBruto = campo(dados, "freteGratisAcima", 20);
  const limite = limiteBruto ? precoParaCentavos(limiteBruto) : null;
  if (gratisLigado && (limite === null || limite <= 0)) {
    return { ok: false, mensagem: "Informe a partir de qual valor o frete é grátis." };
  }

  return salvar([
    { chave: "frete_prazo_manuseio_dias", valor: String(Number(dias)), ligada: Number(dias) > 0 },
    { chave: "frete_gratis_acima_centavos", valor: limite ? String(limite) : "", ligada: gratisLigado },
  ]);
}

export async function acaoSalvarRetirada(_a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  await exigirUsuario("configuracoes");
  const endereco = campo(dados, "endereco", 200);
  const horario = campo(dados, "horario", 200);
  return salvar([
    { chave: "retirada_endereco", valor: endereco, ligada: endereco !== "" },
    { chave: "retirada_horario", valor: horario, ligada: horario !== "" },
  ]);
}

export async function acaoSalvarFaixa(_a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  await exigirUsuario("configuracoes");
  const texto = campo(dados, "texto", 140);
  const link = campo(dados, "link", 300);
  // Link interno ("/pneus?aro=16") ou https: nada de javascript: na vitrine.
  if (link && !link.startsWith("/") && !/^https:\/\//.test(link)) {
    return { ok: false, mensagem: "O link precisa começar com / (página da loja) ou https://." };
  }
  const ligada = dados.get("ligada") === "on" && texto !== "";
  return salvar([
    { chave: "banner_texto", valor: texto, ligada },
    { chave: "banner_link", valor: link, ligada: ligada && link !== "" },
  ]);
}
