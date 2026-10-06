"use client";

import { startTransition, useActionState } from "react";
import { Botao, classesDeCampo } from "@/components/ui/botao";
import type { EstadoDaImportacao } from "@/app/admin/(painel)/produtos/acoes";

export function FormularioDeImportacao({
  acao,
}: {
  acao: (anterior: EstadoDaImportacao, dados: FormData) => Promise<EstadoDaImportacao>;
}) {
  const [estado, enviar, enviando] = useActionState(acao, null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => enviar(dados));
      }}
    >
      <label htmlFor="arquivo" className="block text-xs font-bold uppercase tracking-widest text-tinta-media">
        Arquivo CSV
      </label>
      <input
        id="arquivo"
        name="arquivo"
        type="file"
        accept=".csv,text/csv"
        required
        className={classesDeCampo("mt-1.5 w-full file:mr-3 file:border-0 file:bg-transparent file:font-bold")}
      />
      <Botao type="submit" className="mt-4" disabled={enviando}>
        {enviando ? "Importando… não feche a página" : "Importar"}
      </Botao>

      {estado && (
        <div className="mt-4" role={estado.ok ? "status" : "alert"}>
          <p className={`text-sm font-semibold ${estado.ok ? "text-green-700" : "text-marca"}`}>{estado.mensagem}</p>
          {estado.erros.length > 0 && (
            <div className="mt-3 max-h-80 overflow-y-auto rounded-controle border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-left text-xs uppercase tracking-widest text-tinta-media">
                  <tr>
                    <th scope="col" className="px-3 py-2">Linha</th>
                    <th scope="col" className="px-3 py-2">Problema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {estado.erros.map((e) => (
                    <tr key={`${e.linha}-${e.motivo}`}>
                      <td className="numerais-tabulares px-3 py-1.5 font-bold">{e.linha}</td>
                      <td className="px-3 py-1.5">{e.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
