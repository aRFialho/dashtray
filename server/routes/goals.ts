import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin } from "../middleware/auth";
import { buildDashboardData, getDefaultStore } from "../services/dashboard";
import { evaluateGoalAchievements } from "../services/goal-progress";
import { emitDashboardUpdate } from "../services/realtime";
import { asyncHandler } from "../utils/async-handler";
import { HttpError } from "../utils/http-error";
import { parseMonthKey } from "../utils/date";

const router = Router();
const levelSchema = z.object({
  label: z.string().trim().min(1).max(60),
  targetOrders: z.coerce.number().int().min(1).max(10_000_000)
});
const bodySchema = z.object({
  levels: z.array(levelSchema).max(8)
}).superRefine((input, context) => {
  const targets = input.levels.map((level) => level.targetOrders);
  if (new Set(targets).size !== targets.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["levels"], message: "As metas precisam ter valores diferentes." });
  }
  for (let index = 1; index < targets.length; index += 1) {
    if ((targets[index] ?? 0) <= (targets[index - 1] ?? 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["levels", index, "targetOrders"],
        message: "Os níveis precisam estar em ordem crescente."
      });
    }
  }
});

router.put(
  "/:month",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.params.month);
    const parts = parseMonthKey(month);
    const input = bodySchema.parse(req.body);
    const store = await getDefaultStore();
    if (!store) throw new HttpError(409, "Conecte uma loja Tray antes de definir as metas.");

    await prisma.$transaction(async (transaction) => {
      const previousLevels = await transaction.goalLevel.findMany({
        where: { storeRecordId: store.id, year: parts.year, month: parts.month },
        include: { achievement: true }
      });
      const previousAchievements = new Map<number, { orderCount: number; achievedAt: Date }>();
      previousLevels.forEach((level) => {
        if (level.achievement) {
          previousAchievements.set(level.targetOrders, {
            orderCount: level.achievement.orderCount,
            achievedAt: level.achievement.achievedAt
          });
        }
      });

      await transaction.goalLevel.deleteMany({
        where: { storeRecordId: store.id, year: parts.year, month: parts.month }
      });

      for (const [index, level] of input.levels.entries()) {
        const created = await transaction.goalLevel.create({
          data: {
            storeRecordId: store.id,
            year: parts.year,
            month: parts.month,
            position: index + 1,
            label: level.label,
            targetOrders: level.targetOrders,
            createdBy: req.admin?.email
          }
        });
        const previousAchievement = previousAchievements.get(level.targetOrders);
        if (previousAchievement) {
          await transaction.goalAchievement.create({
            data: {
              goalLevelId: created.id,
              storeRecordId: store.id,
              orderCount: previousAchievement.orderCount,
              achievedAt: previousAchievement.achievedAt
            }
          });
        }
      }

      const highestTarget = input.levels.at(-1)?.targetOrders ?? 0;
      await transaction.goal.upsert({
        where: {
          storeRecordId_year_month: {
            storeRecordId: store.id,
            year: parts.year,
            month: parts.month
          }
        },
        create: {
          storeRecordId: store.id,
          year: parts.year,
          month: parts.month,
          targetOrders: highestTarget,
          createdBy: req.admin?.email
        },
        update: {
          targetOrders: highestTarget,
          createdBy: req.admin?.email
        }
      });
    });

    const beforeEvaluation = await buildDashboardData(month, store.id);
    await evaluateGoalAchievements(store.id, month, beforeEvaluation.summary.orders);
    const dashboard = await buildDashboardData(month, store.id);
    emitDashboardUpdate(dashboard);
    res.json({ dashboard });
  })
);

export default router;
