import { parseFilters } from "@/core/catalog/filters";
import { getCatalogService } from "@/lib/container";

export const dynamic = "force-dynamic";

/**
 * Catálogo público.
 *
 * Esta rota existe para o aplicativo da Fase 2: ela é uma casca fina sobre o
 * mesmo serviço que a loja usa, e não deve ganhar regra de negócio própria.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  for (const [chave, valor] of url.searchParams) params[chave] = valor;

  const filtros = parseFilters(params);

  try {
    const resultado = await getCatalogService().listar(filtros);
    return Response.json({
      items: resultado.items,
      total: resultado.total,
      page: filtros.page,
      perPage: filtros.perPage,
      facets: resultado.facets,
    });
  } catch (erro) {
    console.error("Falha ao listar catálogo", erro);
    return Response.json(
      { error: "Não foi possível carregar o catálogo" },
      { status: 500 },
    );
  }
}
