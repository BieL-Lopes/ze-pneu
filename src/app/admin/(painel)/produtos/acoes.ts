"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/sessao-admin";
import { db } from "@/db/client";
import { importarCatalogo } from "@/db/importar-catalogo";
import {
  adicionarFoto,
  adicionarVariante,
  atualizarProduto,
  atualizarVariante,
  criarProduto,
  removerFoto,
  tornarFotoPrincipal,
} from "@/db/cadastro-de-produtos";
import { validarProduto, validarUrlDeFoto, validarVariante } from "@/core/catalog/cadastro";
import { precoParaCentavos } from "@/core/catalog/csv-import";
import type { EstadoDaAcao } from "@/components/painel/estado-da-acao";

function campo(dados: FormData, nome: string, max = 300): string {
  return String(dados.get(nome) ?? "").slice(0, max);
}

/** Preço, foto e status aparecem na loja: as páginas em cache são refeitas. */
function atualizarLoja(productId?: string) {
  revalidatePath("/", "layout");
  if (productId) revalidatePath(`/admin/produtos/${productId}`);
}

function falha(e: unknown, contexto: string): EstadoDaAcao {
  console.error(contexto, e);
  return { ok: false, mensagem: "Não foi possível salvar agora. Tente de novo." };
}

function produtoDoFormulario(dados: FormData) {
  return validarProduto({
    nome: campo(dados, "nome", 200),
    descricao: campo(dados, "descricao", 6000),
    status: campo(dados, "status", 20),
    marca: campo(dados, "marca", 100),
    categoria: campo(dados, "categoria", 100),
  });
}

export async function acaoCriarProduto(_a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  await exigirUsuario("produtos");
  const produto = produtoDoFormulario(dados);
  if (!produto.ok) return { ok: false, mensagem: produto.error };

  let id: string;
  try {
    id = await criarProduto(produto.value);
  } catch (e) {
    return falha(e, "Falha ao criar produto");
  }
  atualizarLoja();
  redirect(`/admin/produtos/${id}?novo=1`);
}

export async function acaoAtualizarProduto(id: string, _a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  await exigirUsuario("produtos");
  const produto = produtoDoFormulario(dados);
  if (!produto.ok) return { ok: false, mensagem: produto.error };
  try {
    await atualizarProduto(id, produto.value);
  } catch (e) {
    return falha(e, `Falha ao atualizar o produto ${id}`);
  }
  atualizarLoja(id);
  return { ok: true, mensagem: "Produto salvo." };
}

export async function acaoAdicionarVariante(productId: string, _a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  await exigirUsuario("produtos");
  const v = validarVariante({
    sku: campo(dados, "sku", 80),
    ean: campo(dados, "ean", 20),
    preco: campo(dados, "preco", 20),
    medida: campo(dados, "medida", 40),
    tipoVeiculo: campo(dados, "tipoVeiculo", 20),
    pesoKg: campo(dados, "pesoKg", 10),
  });
  if (!v.ok) return { ok: false, mensagem: v.error };
  try {
    const r = await adicionarVariante(productId, v.value);
    if (!r.ok) return { ok: false, mensagem: r.error };
  } catch (e) {
    return falha(e, `Falha ao adicionar variante ao produto ${productId}`);
  }
  atualizarLoja(productId);
  return { ok: true, mensagem: `Medida ${v.value.sku} adicionada. Lance o estoque dela para que apareça à venda.` };
}

export async function acaoAtualizarVariante(
  productId: string,
  variantId: string,
  _a: EstadoDaAcao,
  dados: FormData,
): Promise<EstadoDaAcao> {
  await exigirUsuario("produtos");
  const precoCents = precoParaCentavos(campo(dados, "preco", 20));
  if (precoCents === null || precoCents <= 0) return { ok: false, mensagem: "Preço inválido." };
  const kg = Number(campo(dados, "pesoKg", 10).replace(",", "."));
  if (!Number.isFinite(kg) || kg <= 0 || kg > 500) return { ok: false, mensagem: "Peso inválido." };

  try {
    await atualizarVariante(productId, variantId, {
      precoCents,
      pesoGramas: Math.round(kg * 1000),
      ativa: dados.get("ativa") === "on",
    });
  } catch (e) {
    return falha(e, `Falha ao atualizar a variante ${variantId}`);
  }
  atualizarLoja(productId);
  return { ok: true, mensagem: "Salvo." };
}

export async function acaoAdicionarFoto(productId: string, _a: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao> {
  await exigirUsuario("produtos");
  const url = validarUrlDeFoto(campo(dados, "url", 1000));
  if (!url.ok) return { ok: false, mensagem: url.error };
  const alt = campo(dados, "alt", 200).trim() || "Foto do produto";
  try {
    await adicionarFoto(productId, url.value, alt);
  } catch (e) {
    return falha(e, `Falha ao adicionar foto ao produto ${productId}`);
  }
  atualizarLoja(productId);
  return { ok: true, mensagem: "Foto adicionada." };
}

// Botões soltos na grade de fotos: sem mensagem de volta, a própria grade
// atualizada é a confirmação.
export async function acaoRemoverFoto(productId: string, fotoId: string): Promise<void> {
  await exigirUsuario("produtos");
  await removerFoto(productId, fotoId);
  atualizarLoja(productId);
}

export async function acaoFotoPrincipal(productId: string, fotoId: string): Promise<void> {
  await exigirUsuario("produtos");
  await tornarFotoPrincipal(productId, fotoId);
  atualizarLoja(productId);
}

const LIMITE_DO_ARQUIVO = 4 * 1024 * 1024;

export type EstadoDaImportacao = {
  ok: boolean;
  mensagem: string;
  erros: { linha: number; motivo: string }[];
} | null;

export async function acaoImportarPlanilha(_a: EstadoDaImportacao, dados: FormData): Promise<EstadoDaImportacao> {
  await exigirUsuario("produtos");
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, mensagem: "Escolha o arquivo CSV.", erros: [] };
  }
  if (arquivo.size > LIMITE_DO_ARQUIVO) {
    return { ok: false, mensagem: "Arquivo grande demais (limite de 4 MB). Divida a planilha.", erros: [] };
  }

  try {
    const texto = (await arquivo.text()).replace(/^﻿/, "");
    const r = await importarCatalogo(db, texto);
    atualizarLoja();
    if (r.variantes === 0) {
      return { ok: false, mensagem: "Nenhuma linha válida. Nada foi importado.", erros: r.erros };
    }
    return {
      ok: true,
      mensagem: `${r.variantes} medida(s) importada(s) ou atualizada(s), ${r.produtosNovos} produto(s) novo(s). ${r.erros.length} linha(s) com erro.`,
      erros: r.erros,
    };
  } catch (e) {
    console.error("Falha ao importar planilha pelo painel", e);
    return { ok: false, mensagem: "A importação falhou no meio. Confira o arquivo e tente de novo.", erros: [] };
  }
}
