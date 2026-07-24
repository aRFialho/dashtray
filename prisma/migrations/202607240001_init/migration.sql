CREATE TABLE "tray_stores" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "store_host" TEXT,
    "api_address" TEXT NOT NULL,
    "admin_user" TEXT,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_expires_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tray_stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "store_record_id" TEXT NOT NULL,
    "tray_order_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "modified_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "status_type" TEXT,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "point_sale" TEXT,
    "external_code" TEXT,
    "customer_id" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "store_record_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target_orders" INTEGER NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "store_record_id" TEXT,
    "seller_id" TEXT NOT NULL,
    "scope_name" TEXT NOT NULL,
    "scope_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "next_attempt_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "store_record_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "items" INTEGER NOT NULL DEFAULT 0,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tray_stores_store_id_key" ON "tray_stores"("store_id");
CREATE INDEX "tray_stores_active_idx" ON "tray_stores"("active");
CREATE UNIQUE INDEX "orders_store_record_id_tray_order_id_key" ON "orders"("store_record_id", "tray_order_id");
CREATE INDEX "orders_store_record_id_order_date_idx" ON "orders"("store_record_id", "order_date");
CREATE INDEX "orders_store_record_id_modified_at_idx" ON "orders"("store_record_id", "modified_at");
CREATE UNIQUE INDEX "goals_store_record_id_year_month_key" ON "goals"("store_record_id", "year", "month");
CREATE INDEX "goals_store_record_id_year_month_idx" ON "goals"("store_record_id", "year", "month");
CREATE UNIQUE INDEX "webhook_events_fingerprint_key" ON "webhook_events"("fingerprint");
CREATE INDEX "webhook_events_status_received_at_idx" ON "webhook_events"("status", "received_at");
CREATE INDEX "webhook_events_seller_id_scope_name_scope_id_idx" ON "webhook_events"("seller_id", "scope_name", "scope_id");
CREATE INDEX "sync_logs_store_record_id_started_at_idx" ON "sync_logs"("store_record_id", "started_at");

ALTER TABLE "orders" ADD CONSTRAINT "orders_store_record_id_fkey" FOREIGN KEY ("store_record_id") REFERENCES "tray_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_store_record_id_fkey" FOREIGN KEY ("store_record_id") REFERENCES "tray_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_store_record_id_fkey" FOREIGN KEY ("store_record_id") REFERENCES "tray_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_store_record_id_fkey" FOREIGN KEY ("store_record_id") REFERENCES "tray_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
