/** Resposta de toda Server Action do painel: o que deu certo ou o que impediu. */
export type EstadoDaAcao = { ok: boolean; mensagem: string } | null;

export type AcaoDoPainel = (anterior: EstadoDaAcao, dados: FormData) => Promise<EstadoDaAcao>;
