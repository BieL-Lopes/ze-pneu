import { parseTireSize, type TireSize } from "./tire-size";

export type LinhaCatalogo = {
  marca: string;
  categoria: string;
  produto: string;
  descricao: string | null;
  sku: string;
  ean: string | null;
  precoCents: number;
  medida: TireSize | null;
  tipoVeiculo: string | null;
  pesoGramas: number;
  imagemUrl: string | null;
};

export type ErroImportacao = { linha: number; motivo: string };

const COLUNAS = [
  "marca",
  "categoria",
  "produto",
  "descricao",
  "sku",
  "ean",
  "preco",
  "medida",
  "tipo_veiculo",
  "peso_gramas",
  "imagem_url",
] as const;

/** CSV com suporte a campo entre aspas contendo vírgula. */
function dividirLinha(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (c === "," && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** Aceita "650.00", "650,00" e "1.250,90" — planilha brasileira exporta os três. */
function precoParaCentavos(bruto: string): number | null {
  const texto = bruto.trim();
  if (texto === "") return null;

  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function ouNulo(valor: string): string | null {
  return valor === "" ? null : valor;
}

/**
 * Lê o CSV de catálogo, relatando erro por linha.
 *
 * Uma linha ruim não aborta o arquivo: o cliente vai mandar planilha com
 * sujeira, e importar 480 dos 500 produtos e saber exatamente quais 20
 * falharam é muito melhor do que recusar tudo por causa de uma célula.
 */
export function parseLinhasCatalogo(csv: string): {
  linhas: LinhaCatalogo[];
  erros: ErroImportacao[];
} {
  const linhasBrutas = csv.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (linhasBrutas.length === 0)
    return { linhas: [], erros: [{ linha: 0, motivo: "Arquivo vazio" }] };

  const cabecalho = dividirLinha(linhasBrutas[0]).map((c) => c.toLowerCase());
  const faltando = COLUNAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length)
    return {
      linhas: [],
      erros: [{ linha: 0, motivo: `Coluna faltando: ${faltando.join(", ")}` }],
    };

  const indice = (nome: string) => cabecalho.indexOf(nome);

  const linhas: LinhaCatalogo[] = [];
  const erros: ErroImportacao[] = [];
  const skusVistos = new Set<string>();

  for (let i = 1; i < linhasBrutas.length; i++) {
    // Número da linha no arquivo, contando o cabeçalho como linha 1 — é o que
    // a pessoa vê ao abrir o CSV para corrigir.
    const numero = i + 1;
    const campos = dividirLinha(linhasBrutas[i]);
    const ler = (nome: string) => campos[indice(nome)] ?? "";

    const marca = ler("marca");
    const categoria = ler("categoria");
    const produto = ler("produto");
    const sku = ler("sku");

    const obrigatorios = { marca, categoria, produto, sku };
    const vazio = Object.entries(obrigatorios).find(([, v]) => v === "");
    if (vazio) {
      erros.push({
        linha: numero,
        motivo: `Campo obrigatório vazio: ${vazio[0]}`,
      });
      continue;
    }

    if (skusVistos.has(sku)) {
      erros.push({ linha: numero, motivo: `SKU repetido no arquivo: ${sku}` });
      continue;
    }

    const precoCents = precoParaCentavos(ler("preco"));
    if (precoCents === null) {
      erros.push({ linha: numero, motivo: `Preço inválido: "${ler("preco")}"` });
      continue;
    }

    const pesoGramas = Number(ler("peso_gramas"));
    if (!Number.isFinite(pesoGramas) || pesoGramas <= 0) {
      erros.push({
        linha: numero,
        motivo: `Peso inválido: "${ler("peso_gramas")}" (necessário para cotar frete)`,
      });
      continue;
    }

    let medida: TireSize | null = null;
    const medidaBruta = ler("medida");
    if (medidaBruta !== "") {
      const r = parseTireSize(medidaBruta);
      if (!r.ok) {
        erros.push({ linha: numero, motivo: r.error });
        continue;
      }
      medida = r.value;
    }

    skusVistos.add(sku);
    linhas.push({
      marca,
      categoria,
      produto,
      descricao: ouNulo(ler("descricao")),
      sku,
      ean: ouNulo(ler("ean")),
      precoCents,
      medida,
      tipoVeiculo: ouNulo(ler("tipo_veiculo")),
      pesoGramas,
      imagemUrl: ouNulo(ler("imagem_url")),
    });
  }

  return { linhas, erros };
}
