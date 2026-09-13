import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Textos que a operação precisa trocar sem esperar deploy.
 *
 * A faixa promocional da home vive aqui em vez de no código: promoção muda com
 * frequência e um deploy a cada troca de frase é atrito que faz a loja parar de
 * usar o recurso. O painel administrativo edita esta tabela quando existir.
 */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
