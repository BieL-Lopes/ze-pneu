import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const ADMIN_ROLES = ["admin", "operador"] as const;

/** Quem entra no painel. Cliente da loja não tem conta: compra como visitante. */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ADMIN_ROLES }).notNull().default("operador"),
  active: boolean("active").notNull().default(true),
  // Tentativas erradas seguidas. Ao passar do limite, o acesso trava por um
  // tempo: o painel fica na internet aberta e senha é adivinhável por força.
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Sessão do painel.
 *
 * O cookie carrega um token aleatório; aqui fica só o hash dele. Quem ler o
 * banco não consegue se passar por ninguém, e sair do painel apaga a linha —
 * coisa que um JWT assinado não permite.
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessoes_por_usuario").on(t.userId)],
);
