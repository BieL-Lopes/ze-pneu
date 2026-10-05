CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text NOT NULL,
	"status" text NOT NULL,
	"method" text,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagamento_por_provedor" UNIQUE("provider","provider_payment_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "access_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_method" text DEFAULT 'retirada' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_postal_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_street" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_complement" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_district" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_state" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_service_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_service_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_deadline_days" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cart_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pagamentos_por_pedido" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "pedidos_vencendo" ON "orders" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_access_token_unique" UNIQUE("access_token");