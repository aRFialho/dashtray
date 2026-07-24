CREATE TABLE "goal_levels" (
    "id" TEXT NOT NULL,
    "store_record_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "target_orders" INTEGER NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "goal_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goal_achievements" (
    "id" TEXT NOT NULL,
    "goal_level_id" TEXT NOT NULL,
    "store_record_id" TEXT NOT NULL,
    "order_count" INTEGER NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goal_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goal_levels_store_record_id_year_month_position_key"
ON "goal_levels"("store_record_id", "year", "month", "position");

CREATE UNIQUE INDEX "goal_levels_store_record_id_year_month_target_orders_key"
ON "goal_levels"("store_record_id", "year", "month", "target_orders");

CREATE INDEX "goal_levels_store_record_id_year_month_position_idx"
ON "goal_levels"("store_record_id", "year", "month", "position");

CREATE UNIQUE INDEX "goal_achievements_goal_level_id_key"
ON "goal_achievements"("goal_level_id");

CREATE INDEX "goal_achievements_store_record_id_achieved_at_idx"
ON "goal_achievements"("store_record_id", "achieved_at");

ALTER TABLE "goal_levels"
ADD CONSTRAINT "goal_levels_store_record_id_fkey"
FOREIGN KEY ("store_record_id") REFERENCES "tray_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goal_achievements"
ADD CONSTRAINT "goal_achievements_goal_level_id_fkey"
FOREIGN KEY ("goal_level_id") REFERENCES "goal_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goal_achievements"
ADD CONSTRAINT "goal_achievements_store_record_id_fkey"
FOREIGN KEY ("store_record_id") REFERENCES "tray_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
