import {
  pgTable,
  uuid,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Auto-referência precisa da anotação explícita de tipo, senão o TypeScript
  // não consegue inferir o tipo circular.
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
