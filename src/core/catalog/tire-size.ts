import { type Result, ok, err } from "@/core/shared/result";

export type TireSize = {
  width: number;
  profile: number;
  rim: number;
  loadIndex: number | null;
  speedRating: string | null;
};

/**
 * Aceita as formas que o cliente realmente digita: "205/55 R16 91V",
 * "205/55r16", "205 55 16", "205/55-R16". O separador e o "R" são opcionais
 * porque quem busca no site está copiando da lateral do pneu, não seguindo
 * uma norma.
 */
const PADRAO =
  /^(\d{3})\s*[/\s-]\s*(\d{2})\s*[\s-]?r?\s*(\d{2})(?:\s+(\d{2,3})\s*([a-z]{1,2}))?$/i;

const FAIXAS = {
  width: [125, 405],
  profile: [25, 90],
  rim: [10, 24],
  loadIndex: [50, 130],
} as const;

function dentroDaFaixa(valor: number, faixa: readonly [number, number]) {
  return valor >= faixa[0] && valor <= faixa[1];
}

export function parseTireSize(input: string): Result<TireSize> {
  const texto = input.trim();
  if (texto === "") return err("Medida vazia");

  const m = PADRAO.exec(texto);
  if (!m) return err(`Medida não reconhecida: "${input}"`);

  const width = Number(m[1]);
  const profile = Number(m[2]);
  const rim = Number(m[3]);
  const loadIndex = m[4] ? Number(m[4]) : null;
  const speedRating = m[5] ? m[5].toUpperCase() : null;

  if (!dentroDaFaixa(width, FAIXAS.width))
    return err(`Largura fora da faixa: ${width}`);
  if (!dentroDaFaixa(profile, FAIXAS.profile))
    return err(`Perfil fora da faixa: ${profile}`);
  if (!dentroDaFaixa(rim, FAIXAS.rim)) return err(`Aro fora da faixa: ${rim}`);
  if (loadIndex !== null && !dentroDaFaixa(loadIndex, FAIXAS.loadIndex))
    return err(`Índice de carga fora da faixa: ${loadIndex}`);

  return ok({ width, profile, rim, loadIndex, speedRating });
}

export function formatTireSize(size: TireSize): string {
  const base = `${size.width}/${size.profile} R${size.rim}`;
  if (size.loadIndex === null || size.speedRating === null) return base;
  return `${base} ${size.loadIndex}${size.speedRating}`;
}

/** Slug estável para a URL da faceta de medida, usado em SEO. */
export function tireSizeSlug(size: TireSize): string {
  return `${size.width}-${size.profile}-r${size.rim}`;
}
