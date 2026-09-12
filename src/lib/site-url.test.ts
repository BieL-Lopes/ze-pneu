import { describe, it, expect } from "vitest";
import { resolveSiteUrl } from "./site-url";

describe("resolveSiteUrl", () => {
  it("usa NEXT_PUBLIC_SITE_URL quando configurada", () => {
    const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://zepneu.com.br" });
    expect(url.origin).toBe("https://zepneu.com.br");
  });

  // Regressão do deploy de 2026-09-11: a variável existia na Vercel com valor
  // vazio, e `??` não trata "" como ausente — o build quebrava com Invalid URL.
  it("trata string vazia como ausente", () => {
    const url = resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: "",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "ze-pneu.vercel.app",
    });
    expect(url.origin).toBe("https://ze-pneu.vercel.app");
  });

  it("trata valor só com espaços como ausente", () => {
    const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "   " });
    expect(url.origin).toBe("http://localhost:3000");
  });

  it("completa o protocolo quando a pessoa digita só o domínio", () => {
    const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "zepneu.com.br" });
    expect(url.origin).toBe("https://zepneu.com.br");
  });

  it("em produção na Vercel usa o domínio de produção, não a URL do deploy", () => {
    const url = resolveSiteUrl({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "zepneu.com.br",
      VERCEL_URL: "ze-pneu-abc123-time.vercel.app",
    });
    expect(url.origin).toBe("https://zepneu.com.br");
  });

  it("em preview na Vercel usa a URL do próprio deploy", () => {
    const url = resolveSiteUrl({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_PRODUCTION_URL: "zepneu.com.br",
      VERCEL_URL: "ze-pneu-git-feature-time.vercel.app",
    });
    expect(url.origin).toBe("https://ze-pneu-git-feature-time.vercel.app");
  });

  it("cai em localhost quando nada está configurado", () => {
    expect(resolveSiteUrl({}).origin).toBe("http://localhost:3000");
  });

  it("falha com mensagem que nomeia a variável quando o valor é inválido", () => {
    expect(() => resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "zé pneu" })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });
});
