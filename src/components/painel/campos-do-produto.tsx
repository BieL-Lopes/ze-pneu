import { classesDeCampo } from "@/components/ui/botao";
import { ROTULO_STATUS_PRODUTO, STATUS_DE_PRODUTO } from "@/core/catalog/cadastro";
import { Campo, rotuloDeCampo } from "./campo";

type Valores = {
  nome?: string;
  descricao?: string | null;
  status?: string;
  marca?: string;
  categoria?: string;
};

/**
 * Campos do produto, iguais no cadastro e na edição. Marca e categoria são
 * texto livre com sugestão das existentes: digitar uma nova cria na hora.
 */
export function CamposDoProduto({
  valores = {},
  marcas,
  categorias,
}: {
  valores?: Valores;
  marcas: string[];
  categorias: string[];
}) {
  return (
    <>
      <Campo rotulo="Nome do modelo" nome="nome" defaultValue={valores.nome} required maxLength={120} placeholder="Ex: RA301" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Marca" nome="marca" defaultValue={valores.marca} required list="marcas" maxLength={80} />
        <Campo rotulo="Categoria" nome="categoria" defaultValue={valores.categoria ?? "Pneus"} required list="categorias" maxLength={80} />
      </div>
      <datalist id="marcas">
        {marcas.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id="categorias">
        {categorias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div>
        <label htmlFor="campo-status" className={rotuloDeCampo()}>Situação</label>
        <select id="campo-status" name="status" defaultValue={valores.status ?? "draft"} className={classesDeCampo("mt-1.5 w-full")}>
          {STATUS_DE_PRODUTO.map((s) => (
            <option key={s} value={s}>{ROTULO_STATUS_PRODUTO[s]}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-tinta-media">Rascunho não aparece na loja. Arquivado sai da loja, mas os pedidos antigos continuam.</p>
      </div>
      <div>
        <label htmlFor="campo-descricao" className={rotuloDeCampo()}>Descrição</label>
        <textarea
          id="campo-descricao"
          name="descricao"
          rows={6}
          maxLength={5000}
          defaultValue={valores.descricao ?? ""}
          className={classesDeCampo("mt-1.5 w-full")}
        />
      </div>
    </>
  );
}
