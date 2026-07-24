import type { GoalLevel } from "@prisma/client";
import { prisma } from "../db";
import { parseMonthKey } from "../utils/date";

export type GoalAchievementPayload = {
  id: string;
  month: string;
  levelId: string;
  position: number;
  label: string;
  targetOrders: number;
  orderCount: number;
  achievedAt: Date;
  nextLevel: null | {
    position: number;
    label: string;
    targetOrders: number;
  };
};

export async function ensureGoalLevels(storeRecordId: string, month: string) {
  const parts = parseMonthKey(month);
  const levels = await prisma.goalLevel.findMany({
    where: { storeRecordId, year: parts.year, month: parts.month },
    orderBy: { position: "asc" },
    include: { achievement: true }
  });

  if (levels.length > 0) return levels;

  const legacyGoal = await prisma.goal.findUnique({
    where: {
      storeRecordId_year_month: {
        storeRecordId,
        year: parts.year,
        month: parts.month
      }
    }
  });

  if (!legacyGoal || legacyGoal.targetOrders <= 0) return [];

  await prisma.goalLevel.upsert({
    where: {
      storeRecordId_year_month_position: {
        storeRecordId,
        year: parts.year,
        month: parts.month,
        position: 1
      }
    },
    create: {
      storeRecordId,
      year: parts.year,
      month: parts.month,
      position: 1,
      label: "Meta principal",
      targetOrders: legacyGoal.targetOrders,
      createdBy: legacyGoal.createdBy
    },
    update: {}
  });

  return prisma.goalLevel.findMany({
    where: { storeRecordId, year: parts.year, month: parts.month },
    orderBy: { position: "asc" },
    include: { achievement: true }
  });
}

function nextLevelAfter(levels: GoalLevel[], position: number) {
  const next = levels.find((level) => level.position > position);
  return next
    ? { position: next.position, label: next.label, targetOrders: next.targetOrders }
    : null;
}

export async function evaluateGoalAchievements(
  storeRecordId: string,
  month: string,
  orderCount: number
): Promise<GoalAchievementPayload[]> {
  const levelsWithAchievements = await ensureGoalLevels(storeRecordId, month);
  const levels = levelsWithAchievements.map(({ achievement: _achievement, ...level }) => level);
  const newlyAchieved: GoalAchievementPayload[] = [];

  for (const level of levelsWithAchievements) {
    if (level.achievement || orderCount < level.targetOrders) continue;

    try {
      const achievement = await prisma.goalAchievement.create({
        data: {
          goalLevelId: level.id,
          storeRecordId,
          orderCount
        }
      });

      newlyAchieved.push({
        id: achievement.id,
        month,
        levelId: level.id,
        position: level.position,
        label: level.label,
        targetOrders: level.targetOrders,
        orderCount,
        achievedAt: achievement.achievedAt,
        nextLevel: nextLevelAfter(levels, level.position)
      });
    } catch (error) {
      // Outra instância pode ter registrado a mesma conquista entre a leitura e a criação.
      const existing = await prisma.goalAchievement.findUnique({ where: { goalLevelId: level.id } });
      if (!existing) throw error;
    }
  }

  return newlyAchieved;
}
