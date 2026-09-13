import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { stockBalances, stockMovements, stockReservations } from "@/db/schema";
import type { StockRepository } from "@/core/stock/stock-repository";
import type {
  Disponibilidade,
  FalhaDeEstoque,
  Movimento,
  PedidoDeReserva,
} from "@/core/stock/types";
import { type Result, ok, err } from "@/core/shared/result";

export function createDrizzleStockRepository(
  db: Database,
  locationId: string,
): StockRepository {
  const repo: StockRepository = {
    async disponibilidadeDe(variantIds: string[]): Promise<Disponibilidade[]> {
      if (variantIds.length === 0) return [];

      const linhas = await db
        .select({
          variantId: stockBalances.variantId,
          onHand: stockBalances.onHand,
          reserved: stockBalances.reserved,
        })
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.locationId, locationId),
            inArray(stockBalances.variantId, variantIds),
          ),
        );

      const porId = new Map(linhas.map((l) => [l.variantId, l]));

      // SKU sem linha de saldo nunca teve movimento: disponibilidade zero, e
      // não "ausente". Quem consome não deve precisar tratar o caso faltante.
      return variantIds.map((variantId) => {
        const l = porId.get(variantId);
        const onHand = l?.onHand ?? 0;
        const reserved = l?.reserved ?? 0;
        return { variantId, onHand, reserved, disponivel: onHand - reserved };
      });
    },

    async registrarEntrada({ variantId, quantity, reason, authorId }) {
      await db.transaction(async (tx) => {
        await tx
          .insert(stockBalances)
          .values({ variantId, locationId, onHand: quantity, reserved: 0 })
          .onConflictDoUpdate({
            target: [stockBalances.variantId, stockBalances.locationId],
            set: {
              onHand: sql`${stockBalances.onHand} + ${quantity}`,
              updatedAt: new Date(),
            },
          });

        await tx.insert(stockMovements).values({
          variantId,
          locationId,
          kind: "entrada",
          quantity,
          reason,
          authorId,
        });
      });
    },

    /**
     * Ou reserva o pedido inteiro, ou não reserva nada.
     *
     * As linhas de saldo são travadas com SELECT ... FOR UPDATE em ordem
     * determinística (por variantId). Sem a ordem fixa, dois pedidos com os
     * mesmos SKUs em ordem inversa se travariam mutuamente (deadlock).
     *
     * A falha é devolvida como valor, não como exceção, e por isso a transação
     * é encerrada com um rollback explícito carregando o motivo já decidido.
     */
    async reservar({
      orderRef,
      itens,
      expiresAt,
    }: {
      orderRef: string;
      itens: PedidoDeReserva[];
      expiresAt: Date;
    }): Promise<Result<void, FalhaDeEstoque>> {
      const ordenados = [...itens].sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      );

      let motivo: FalhaDeEstoque | null = null;

      try {
        await db.transaction(async (tx) => {
          for (const item of ordenados) {
            const travadas = await tx
              .select({
                onHand: stockBalances.onHand,
                reserved: stockBalances.reserved,
              })
              .from(stockBalances)
              .where(
                and(
                  eq(stockBalances.variantId, item.variantId),
                  eq(stockBalances.locationId, locationId),
                ),
              )
              .for("update");

            const saldo = travadas[0];

            if (!saldo) {
              motivo = { tipo: "sku_sem_estoque", variantId: item.variantId };
              tx.rollback();
              return;
            }

            const disponivel = saldo.onHand - saldo.reserved;
            if (disponivel < item.quantity) {
              motivo = {
                tipo: "indisponivel",
                variantId: item.variantId,
                pedido: item.quantity,
                disponivel,
              };
              tx.rollback();
              return;
            }
          }

          for (const item of ordenados) {
            await tx
              .update(stockBalances)
              .set({
                reserved: sql`${stockBalances.reserved} + ${item.quantity}`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(stockBalances.variantId, item.variantId),
                  eq(stockBalances.locationId, locationId),
                ),
              );

            await tx.insert(stockMovements).values({
              variantId: item.variantId,
              locationId,
              kind: "reserva",
              quantity: item.quantity,
              orderRef,
            });

            await tx.insert(stockReservations).values({
              variantId: item.variantId,
              locationId,
              orderRef,
              quantity: item.quantity,
              expiresAt,
            });
          }
        });
      } catch (e) {
        // O rollback do Drizzle lança para desfazer a transação. Se o motivo já
        // foi decidido acima, a falha é esperada; qualquer outro erro sobe.
        if (motivo === null) throw e;
      }

      return motivo === null ? ok(undefined) : err(motivo);
    },

    async liberarReserva(orderRef: string) {
      await db.transaction(async (tx) => {
        const reservas = await tx
          .select()
          .from(stockReservations)
          .where(
            and(
              eq(stockReservations.orderRef, orderRef),
              eq(stockReservations.status, "ativa"),
            ),
          );

        for (const r of reservas) {
          await tx
            .update(stockBalances)
            .set({
              reserved: sql`${stockBalances.reserved} - ${r.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(stockBalances.variantId, r.variantId),
                eq(stockBalances.locationId, r.locationId),
              ),
            );

          await tx.insert(stockMovements).values({
            variantId: r.variantId,
            locationId: r.locationId,
            kind: "liberacao",
            quantity: r.quantity,
            orderRef,
          });
        }

        if (reservas.length > 0) {
          await tx
            .update(stockReservations)
            .set({ status: "liberada" })
            .where(
              and(
                eq(stockReservations.orderRef, orderRef),
                eq(stockReservations.status, "ativa"),
              ),
            );
        }
      });
    },

    async consumirReserva(
      orderRef: string,
    ): Promise<Result<void, FalhaDeEstoque>> {
      const consumidas = await db.transaction(async (tx) => {
        const reservas = await tx
          .select()
          .from(stockReservations)
          .where(
            and(
              eq(stockReservations.orderRef, orderRef),
              eq(stockReservations.status, "ativa"),
            ),
          );

        for (const r of reservas) {
          await tx
            .update(stockBalances)
            .set({
              onHand: sql`${stockBalances.onHand} - ${r.quantity}`,
              reserved: sql`${stockBalances.reserved} - ${r.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(stockBalances.variantId, r.variantId),
                eq(stockBalances.locationId, r.locationId),
              ),
            );

          await tx.insert(stockMovements).values({
            variantId: r.variantId,
            locationId: r.locationId,
            kind: "baixa",
            quantity: r.quantity,
            orderRef,
          });
        }

        if (reservas.length > 0) {
          await tx
            .update(stockReservations)
            .set({ status: "consumida" })
            .where(
              and(
                eq(stockReservations.orderRef, orderRef),
                eq(stockReservations.status, "ativa"),
              ),
            );
        }

        return reservas.length;
      });

      if (consumidas === 0) {
        return err<FalhaDeEstoque>({ tipo: "reserva_inexistente", orderRef });
      }
      return ok(undefined);
    },

    async ajustar({ variantId, delta, reason, authorId }) {
      await db.transaction(async (tx) => {
        await tx
          .insert(stockBalances)
          .values({ variantId, locationId, onHand: delta, reserved: 0 })
          .onConflictDoUpdate({
            target: [stockBalances.variantId, stockBalances.locationId],
            set: {
              onHand: sql`${stockBalances.onHand} + ${delta}`,
              updatedAt: new Date(),
            },
          });

        await tx.insert(stockMovements).values({
          variantId,
          locationId,
          kind: "ajuste",
          quantity: delta,
          reason,
          authorId,
        });
      });
    },

    async extrato(variantId: string): Promise<Movimento[]> {
      return db
        .select({
          id: stockMovements.id,
          kind: stockMovements.kind,
          quantity: stockMovements.quantity,
          reason: stockMovements.reason,
          orderRef: stockMovements.orderRef,
          authorId: stockMovements.authorId,
          createdAt: stockMovements.createdAt,
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.variantId, variantId),
            eq(stockMovements.locationId, locationId),
          ),
        )
        .orderBy(stockMovements.createdAt);
    },

    async liberarVencidas(agora: Date): Promise<number> {
      const vencidas = await db
        .select({ orderRef: stockReservations.orderRef })
        .from(stockReservations)
        .where(
          and(
            eq(stockReservations.status, "ativa"),
            lte(stockReservations.expiresAt, agora),
          ),
        );

      const pedidos = [...new Set(vencidas.map((v) => v.orderRef))];
      for (const ref of pedidos) {
        await repo.liberarReserva(ref);
      }
      return pedidos.length;
    },
  };

  return repo;
}
