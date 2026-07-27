import { env } from "../config/env";
import { prisma } from "../db";
import { currentDateParts, currentMonth } from "../utils/date";

export type DailyGoalAchievementPayload = {
  type: "daily";
  id: string;
  month: string;
  date: string;
  levelId: string;
  goalLabel: string;
  monthlyTarget: number;
  label: string;
  targetOrders: number;
  orderCount: number;
  achievedAt: Date;
};


type DailyGoalAchievementDelegate = {
  create(args: {
    data: {
      storeRecordId: string;
      goalLevelId: string;
      year: number;
      month: number;
      day: number;
      targetOrders: number;
      orderCount: number;
    };
  }): Promise<{ id: string; achievedAt: Date }>;
  findUnique(args: {
    where: {
      storeRecordId_year_month_day_goalLevelId: {
        storeRecordId: string;
        goalLevelId: string;
        year: number;
        month: number;
        day: number;
      };
    };
  }): Promise<{ id: string } | null>;
};

// O Prisma Client é regenerado no build do Render. O cast mantém o typecheck
// compatível também em ambientes que ainda possuem o client da versão anterior.
const dailyGoalAchievements = (prisma as unknown as {
  dailyGoalAchievement: DailyGoalAchievementDelegate;
}).dailyGoalAchievement;

type DailyGoalSnapshot = {
  month: string;
  summary: {
    dailyGoal: number;
    todayOrders: number;
    dailyGoalAchieved: boolean;
  };
  goals: {
    allCompleted: boolean;
    activeLevel: null | {
      id: string;
      label: string;
      targetOrders: number;
    };
  };
};

export async function evaluateDailyGoalAchievement(
  storeRecordId: string,
  month: string,
  dashboard: DailyGoalSnapshot
): Promise<DailyGoalAchievementPayload | null> {
  if (month !== currentMonth(env.APP_TIMEZONE) || dashboard.month !== month) return null;

  const level = dashboard.goals.activeLevel;
  const targetOrders = dashboard.summary.dailyGoal;
  const orderCount = dashboard.summary.todayOrders;
  if (!level || dashboard.goals.allCompleted || targetOrders <= 0 || !dashboard.summary.dailyGoalAchieved) {
    return null;
  }

  const date = currentDateParts(env.APP_TIMEZONE);
  const unique = {
    storeRecordId,
    year: date.year,
    month: date.month,
    day: date.day,
    goalLevelId: level.id
  };

  try {
    const achievement = await dailyGoalAchievements.create({
      data: {
        ...unique,
        targetOrders,
        orderCount
      }
    });

    return {
      type: "daily",
      id: achievement.id,
      month,
      date: `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
      levelId: level.id,
      goalLabel: level.label,
      monthlyTarget: level.targetOrders,
      label: "Meta diária",
      targetOrders,
      orderCount,
      achievedAt: achievement.achievedAt
    };
  } catch (error) {
    // Outra instância pode ter registrado a mesma conquista no mesmo instante.
    const existing = await dailyGoalAchievements.findUnique({
      where: { storeRecordId_year_month_day_goalLevelId: unique }
    });
    if (!existing) throw error;
    return null;
  }
}
