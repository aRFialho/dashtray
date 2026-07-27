CREATE TABLE "daily_goal_achievements" (
    "id" TEXT NOT NULL,
    "store_record_id" TEXT NOT NULL,
    "goal_level_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "target_orders" INTEGER NOT NULL,
    "order_count" INTEGER NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_goal_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_goal_achievements_store_record_id_year_month_day_goal_level_id_key"
ON "daily_goal_achievements"("store_record_id", "year", "month", "day", "goal_level_id");

CREATE INDEX "daily_goal_achievements_store_record_id_year_month_day_idx"
ON "daily_goal_achievements"("store_record_id", "year", "month", "day");

CREATE INDEX "daily_goal_achievements_goal_level_id_achieved_at_idx"
ON "daily_goal_achievements"("goal_level_id", "achieved_at");

ALTER TABLE "daily_goal_achievements"
ADD CONSTRAINT "daily_goal_achievements_store_record_id_fkey"
FOREIGN KEY ("store_record_id") REFERENCES "tray_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_goal_achievements"
ADD CONSTRAINT "daily_goal_achievements_goal_level_id_fkey"
FOREIGN KEY ("goal_level_id") REFERENCES "goal_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
