import { describe, it, expect } from "vitest";
import { conferirSenha, gerarHashDeSenha, gerarSenhaProvisoria, problemaNaSenha } from "./senha";
import { podeAcessar } from "./papeis";

describe("senha", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const hash = await gerarHashDeSenha("pneu-careca-2026");
    expect(await conferirSenha("pneu-careca-2026", hash)).toBe(true);
    expect(await conferirSenha("pneu-careca-2027", hash)).toBe(false);
  });

  it("dois hashes da mesma senha são diferentes (sal aleatório)", async () => {
    const a = await gerarHashDeSenha("mesma-senha-sempre");
    const b = await gerarHashDeSenha("mesma-senha-sempre");
    expect(a).not.toBe(b);
  });

  it("hash em formato desconhecido nunca confere", async () => {
    expect(await conferirSenha("qualquer", "md5$abc")).toBe(false);
  });

  it("exige pelo menos 10 caracteres", () => {
    expect(problemaNaSenha("curta")).not.toBeNull();
    expect(problemaNaSenha("comprida-o-bastante")).toBeNull();
  });

  it("senha provisória já passa na regra", () => {
    expect(problemaNaSenha(gerarSenhaProvisoria())).toBeNull();
  });
});

describe("papéis", () => {
  it("operador cuida de pedidos e estoque, não de preço nem de acesso", () => {
    expect(podeAcessar("operador", "pedidos")).toBe(true);
    expect(podeAcessar("operador", "estoque")).toBe(true);
    expect(podeAcessar("operador", "produtos")).toBe(false);
    expect(podeAcessar("operador", "usuarios")).toBe(false);
  });

  it("admin acessa tudo", () => {
    expect(podeAcessar("admin", "configuracoes")).toBe(true);
    expect(podeAcessar("admin", "usuarios")).toBe(true);
  });
});
