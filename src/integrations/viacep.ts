export type EnderecoDoCep = {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/**
 * Preenche o endereço a partir do CEP.
 *
 * É conveniência: se o ViaCEP falhar, o cliente digita o endereço à mão. Por
 * isso devolve null em vez de lançar.
 */
export async function buscarCep(
  cep: string,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<EnderecoDoCep | null> {
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (dados.erro) return null;
    return {
      rua: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      uf: dados.uf ?? "",
    };
  } catch {
    return null;
  }
}
