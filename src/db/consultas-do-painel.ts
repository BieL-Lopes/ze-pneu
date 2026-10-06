import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, sum } from "drizzle-orm";
import { db } from "@/db/client";
import {
  adminUsers,
  brands,
  categories,
  orderItems,
  orders,
  payments,
  productMedia,
  products,
  productVariants,
  siteSettings,
  stockBalances,
} from "@/db/schema";
import type { OrderStatus } from "@/core/orders/order-status";

/**
 * Leituras do painel: listas, filtros e relatórios.
 *
 * Ficam fora do núcleo de propósito. São consultas de tela, sem regra de
 * negócio — passá-las por uma porta só acrescentaria uma camada que repete o
 * SQL. Toda escrita continua indo pelo núcleo.
 */

export const POR_PAGINA = 30;

/** Status que contam como venda: o dinheiro entrou e não voltou. */
export const STATUS_DE_VENDA: OrderStatus[] = [
  "pago",
  "em_separacao",
  "enviado",
  "pronto_para_retirada",
  "entregue",
  "retirado",
];

function termo(busca: string) {
  return `%${busca.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
}

function rotuloDaMedida(v: {
  width: number | null;
  profile: number | null;
  rim: number | null;
  loadIndex: number | null;
  speedRating: string | null;
}): string | null {
  if (!v.width || !v.profile || !v.rim) return null;
  const indice = v.loadIndex && v.speedRating ? ` ${v.loadIndex}${v.speedRating}` : "";
  return `${v.width}/${v.profile} R${v.rim}${indice}`;
}

// --- Painel inicial -----------------------------------------------------------

export async function resumoDoPainel(desde: Date, ate: Date) {
  const periodo = and(gte(orders.createdAt, desde), lte(orders.createdAt, ate));
  const vendido = inArray(orders.status, STATUS_DE_VENDA);

  const [[vendas], porStatus, maisVendidos, porDia, [semEstoque]] = await Promise.all([
    db
      .select({ pedidos: count(), totalCents: sum(orders.totalCents) })
      .from(orders)
      .where(and(periodo, vendido)),

    db.select({ status: orders.status, quantidade: count() }).from(orders).groupBy(orders.status),

    db
      .select({
        sku: orderItems.sku,
        produto: orderItems.productName,
        medida: orderItems.sizeLabel,
        unidades: sum(orderItems.quantity).mapWith(Number),
        receitaCents: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPriceCents})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(periodo, vendido))
      .groupBy(orderItems.sku, orderItems.productName, orderItems.sizeLabel)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(10),

    db
      .select({
        dia: sql<string>`to_char(${orders.createdAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
        pedidos: count(),
        totalCents: sum(orders.totalCents).mapWith(Number),
      })
      .from(orders)
      .where(and(periodo, vendido))
      .groupBy(sql`1`)
      .orderBy(sql`1`),

    db
      .select({ quantidade: count() })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(stockBalances, eq(stockBalances.variantId, productVariants.id))
      .where(
        and(
          eq(productVariants.status, "active"),
          eq(products.status, "active"),
          sql`coalesce(${stockBalances.onHand}, 0) - coalesce(${stockBalances.reserved}, 0) <= 0`,
        ),
      ),
  ]);

  return {
    vendas: { pedidos: vendas.pedidos, totalCents: Number(vendas.totalCents ?? 0) },
    porStatus: Object.fromEntries(porStatus.map((s) => [s.status, s.quantidade])) as Partial<
      Record<OrderStatus, number>
    >,
    maisVendidos,
    porDia,
    skusSemEstoque: semEstoque.quantidade,
  };
}

// --- Pedidos -----------------------------------------------------------------

export async function listarPedidos(filtro: { status?: OrderStatus | "a_tratar"; busca?: string; pagina: number }) {
  const condicoes = [];
  if (filtro.status === "a_tratar") {
    condicoes.push(inArray(orders.status, ["pago", "em_separacao", "pronto_para_retirada"]));
  } else if (filtro.status) {
    condicoes.push(eq(orders.status, filtro.status));
  }
  if (filtro.busca?.trim()) {
    const t = termo(filtro.busca);
    condicoes.push(
      or(
        ilike(orders.reference, t),
        ilike(orders.customerName, t),
        ilike(orders.customerEmail, t),
        ilike(orders.customerPhone, termo(filtro.busca.replace(/\D/g, "") || filtro.busca)),
      ),
    );
  }
  const onde = condicoes.length ? and(...condicoes) : undefined;

  const [linhas, [total]] = await Promise.all([
    db
      .select({
        reference: orders.reference,
        status: orders.status,
        cliente: orders.customerName,
        telefone: orders.customerPhone,
        recebimento: orders.deliveryMethod,
        cidade: orders.shippingCity,
        uf: orders.shippingState,
        totalCents: orders.totalCents,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(onde)
      .orderBy(desc(orders.createdAt))
      .limit(POR_PAGINA)
      .offset((filtro.pagina - 1) * POR_PAGINA),
    db.select({ n: count() }).from(orders).where(onde),
  ]);

  return { linhas, total: total.n };
}

export async function pagamentosDoPedido(orderId: string) {
  return db
    .select({
      id: payments.providerPaymentId,
      provedor: payments.provider,
      status: payments.status,
      metodo: payments.method,
      valorCents: payments.amountCents,
      atualizadoEm: payments.updatedAt,
    })
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.updatedAt));
}

// --- Estoque -----------------------------------------------------------------

export type FiltroDeEstoque = "todos" | "sem_estoque" | "baixo";

export async function listarSaldos(filtro: { busca?: string; situacao: FiltroDeEstoque; pagina: number }) {
  const disponivel = sql<number>`coalesce(${stockBalances.onHand}, 0) - coalesce(${stockBalances.reserved}, 0)`;
  const condicoes = [eq(productVariants.status, "active")];
  if (filtro.situacao === "sem_estoque") condicoes.push(sql`${disponivel} <= 0`);
  if (filtro.situacao === "baixo") condicoes.push(sql`${disponivel} between 1 and 4`);
  if (filtro.busca?.trim()) {
    const t = termo(filtro.busca);
    const medida = filtro.busca.replace(/\D/g, "");
    condicoes.push(
      or(
        ilike(productVariants.sku, t),
        ilike(products.name, t),
        ilike(brands.name, t),
        medida.length >= 5
          ? sql`concat(${productVariants.width}, ${productVariants.profile}, ${productVariants.rim}) like ${`%${medida}%`}`
          : undefined,
      )!,
    );
  }
  const onde = and(...condicoes);

  const base = db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      produto: products.name,
      marca: brands.name,
      width: productVariants.width,
      profile: productVariants.profile,
      rim: productVariants.rim,
      loadIndex: productVariants.loadIndex,
      speedRating: productVariants.speedRating,
      priceCents: productVariants.priceCents,
      onHand: sql<number>`coalesce(${stockBalances.onHand}, 0)`.mapWith(Number),
      reserved: sql<number>`coalesce(${stockBalances.reserved}, 0)`.mapWith(Number),
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(stockBalances, eq(stockBalances.variantId, productVariants.id));

  const [linhas, [total]] = await Promise.all([
    base
      .where(onde)
      .orderBy(asc(brands.name), asc(products.name), asc(productVariants.rim), asc(productVariants.width))
      .limit(POR_PAGINA)
      .offset((filtro.pagina - 1) * POR_PAGINA),
    db
      .select({ n: count() })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(stockBalances, eq(stockBalances.variantId, productVariants.id))
      .where(onde),
  ]);

  return {
    linhas: linhas.map((l) => ({ ...l, medida: rotuloDaMedida(l), disponivel: l.onHand - l.reserved })),
    total: total.n,
  };
}

export async function varianteDoEstoque(sku: string) {
  const [v] = await db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      produto: products.name,
      produtoId: products.id,
      marca: brands.name,
      width: productVariants.width,
      profile: productVariants.profile,
      rim: productVariants.rim,
      loadIndex: productVariants.loadIndex,
      speedRating: productVariants.speedRating,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(eq(productVariants.sku, sku))
    .limit(1);
  return v ? { ...v, medida: rotuloDaMedida(v) } : null;
}

// --- Produtos ----------------------------------------------------------------

export async function listarProdutos(filtro: {
  busca?: string;
  status?: "draft" | "active" | "archived";
  pagina: number;
}) {
  const condicoes = [];
  if (filtro.status) condicoes.push(eq(products.status, filtro.status));
  if (filtro.busca?.trim()) {
    const t = termo(filtro.busca);
    condicoes.push(or(ilike(products.name, t), ilike(brands.name, t)));
  }
  const onde = condicoes.length ? and(...condicoes) : undefined;

  const [linhas, [total]] = await Promise.all([
    db
      .select({
        id: products.id,
        nome: products.name,
        slug: products.slug,
        status: products.status,
        marca: brands.name,
        categoria: categories.name,
        variantes: sql<number>`(select count(*) from ${productVariants} where ${productVariants.productId} = ${products.id})`.mapWith(Number),
        menorPrecoCents: sql<number | null>`(select min(${productVariants.priceCents}) from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.status} = 'active')`.mapWith(
          (v) => (v === null ? null : Number(v)),
        ),
        foto: sql<string | null>`(select ${productMedia.url} from ${productMedia} where ${productMedia.productId} = ${products.id} order by ${productMedia.position} limit 1)`,
      })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(onde)
      .orderBy(asc(brands.name), asc(products.name))
      .limit(POR_PAGINA)
      .offset((filtro.pagina - 1) * POR_PAGINA),
    db
      .select({ n: count() })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .where(onde),
  ]);
  return { linhas, total: total.n };
}

export async function produtoParaEdicao(id: string) {
  const [produto] = await db
    .select({
      id: products.id,
      nome: products.name,
      slug: products.slug,
      descricao: products.description,
      status: products.status,
      marca: brands.name,
      categoria: categories.name,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id))
    .limit(1);
  if (!produto) return null;

  const [variantes, fotos, listas] = await Promise.all([
    db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        ean: productVariants.ean,
        priceCents: productVariants.priceCents,
        status: productVariants.status,
        weightGrams: productVariants.weightGrams,
        width: productVariants.width,
        profile: productVariants.profile,
        rim: productVariants.rim,
        loadIndex: productVariants.loadIndex,
        speedRating: productVariants.speedRating,
        disponivel: sql<number>`coalesce(${stockBalances.onHand}, 0) - coalesce(${stockBalances.reserved}, 0)`.mapWith(Number),
      })
      .from(productVariants)
      .leftJoin(stockBalances, eq(stockBalances.variantId, productVariants.id))
      .where(eq(productVariants.productId, id))
      .orderBy(asc(productVariants.rim), asc(productVariants.width), asc(productVariants.profile)),
    db
      .select({ id: productMedia.id, url: productMedia.url, alt: productMedia.alt, position: productMedia.position })
      .from(productMedia)
      .where(eq(productMedia.productId, id))
      .orderBy(asc(productMedia.position)),
    marcasECategorias(),
  ]);

  return {
    produto,
    variantes: variantes.map((v) => ({ ...v, medida: rotuloDaMedida(v) })),
    fotos,
    ...listas,
  };
}

// --- Usuários e configurações --------------------------------------------------

export async function listarUsuarios() {
  return db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      nome: adminUsers.name,
      papel: adminUsers.role,
      ativo: adminUsers.active,
      ultimoAcesso: adminUsers.lastLoginAt,
    })
    .from(adminUsers)
    .orderBy(desc(adminUsers.active), asc(adminUsers.name));
}

/** Todas as configurações, ligadas ou não: o painel mostra e edita as duas. */
export async function lerConfiguracoesDoPainel(chaves: string[]) {
  const linhas = await db
    .select({ key: siteSettings.key, value: siteSettings.value, enabled: siteSettings.enabled })
    .from(siteSettings)
    .where(inArray(siteSettings.key, chaves));
  return Object.fromEntries(linhas.map((l) => [l.key, { valor: l.value ?? "", ligada: l.enabled }])) as Record<
    string,
    { valor: string; ligada: boolean } | undefined
  >;
}

export async function gravarConfiguracoes(valores: { chave: string; valor: string; ligada: boolean }[]) {
  if (valores.length === 0) return;
  await db
    .insert(siteSettings)
    .values(valores.map((v) => ({ key: v.chave, value: v.valor, enabled: v.ligada })))
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: sql`excluded.value`,
        enabled: sql`excluded.enabled`,
        updatedAt: new Date(),
      },
    });
}


export async function marcasECategorias() {
  const [m, c] = await Promise.all([
    db.select({ nome: brands.name }).from(brands).orderBy(asc(brands.name)),
    db.select({ nome: categories.name }).from(categories).orderBy(asc(categories.name)),
  ]);
  return { marcas: m.map((x) => x.nome), categorias: c.map((x) => x.nome) };
}
