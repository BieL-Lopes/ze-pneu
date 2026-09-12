type Env = Record<string, string | undefined>;

/** Valor configurado de verdade: string vazia ou só espaços conta como ausente. */
function preenchido(valor: string | undefined): string | undefined {
  const v = valor?.trim();
  return v ? v : undefined;
}

function comProtocolo(host: string): string {
  return /^https?:\/\//i.test(host) ? host : `https://${host}`;
}

/**
 * URL pública do site, usada em metadata, sitemap e robots.
 *
 * Ordem de resolução:
 *   1. NEXT_PUBLIC_SITE_URL, quando preenchida
 *   2. Na Vercel em produção, o domínio de produção do projeto
 *   3. Na Vercel em preview, a URL do próprio deploy
 *   4. localhost, em desenvolvimento
 *
 * String vazia conta como ausente. Foi exatamente isso que derrubou o primeiro
 * deploy: a variável existia na Vercel sem valor, e `??` só cai no fallback com
 * null/undefined — então o build tentava `new URL("")`.
 *
 * Em produção, o domínio vem de VERCEL_PROJECT_PRODUCTION_URL e não de
 * VERCEL_URL: a segunda é a URL única de cada deploy, e canonical e sitemap
 * precisam de um endereço estável.
 */
export function resolveSiteUrl(env: Env): URL {
  const configurada = preenchido(env.NEXT_PUBLIC_SITE_URL);
  if (configurada) {
    try {
      return new URL(comProtocolo(configurada));
    } catch {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL inválida: "${configurada}". ` +
          `Use o endereço completo do site, como https://zepneu.com.br`,
      );
    }
  }

  const producao = preenchido(env.VERCEL_PROJECT_PRODUCTION_URL);
  if (env.VERCEL_ENV === "production" && producao) {
    return new URL(comProtocolo(producao));
  }

  const deploy = preenchido(env.VERCEL_URL);
  if (deploy) return new URL(comProtocolo(deploy));

  return new URL("http://localhost:3000");
}

/** URL do site para o ambiente atual. Só para código de servidor. */
export function siteUrl(): URL {
  return resolveSiteUrl(process.env);
}
