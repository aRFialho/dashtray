import type { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../db";
import {
  currentDay,
  currentMonth,
  dayInTimeZone,
  daysInMonth,
  liveMonthRangeUtc,
  monthRangeUtc,
  parseMonthKey
} from "../utils/date";
import { ensureGoalLevels } from "./goal-progress";

export async function getDefaultStore() {
  return prisma.trayStore.findFirst({
    where: { active: true },
    orderBy: { installedAt: "asc" }
  });
}

function emptyGoals() {
  return {
    levels: [],
    activeLevel: null,
    nextLevel: null,
    completedCount: 0,
    totalCount: 0,
    allCompleted: false,
    stageProgress: 0
  };
}

export async function buildDashboardData(month = currentMonth(env.APP_TIMEZONE), storeRecordId?: string) {
  const now = new Date();
  const parts = parseMonthKey(month);
  const currentMonthKey = currentMonth(env.APP_TIMEZONE, now);
  const isCurrent = month === currentMonthKey;
  const totalDays = daysInMonth(parts);
  const fullMonthRange = monthRangeUtc(parts, env.APP_TIMEZONE);
  const selectedRange = isCurrent
    ? liveMonthRangeUtc(env.APP_TIMEZONE, now)
    : { ...fullMonthRange, monthEnd: fullMonthRange.end };
  const store = storeRecordId
    ? await prisma.trayStore.findUnique({ where: { id: storeRecordId } })
    : await getDefaultStore();

  const emptySummary = {
    orders: 0,
    goal: 0,
    goalLabel: "Nenhuma meta",
    progress: 0,
    remaining: 0,
    dailyAverage: 0,
    projectedOrders: 0,
    requiredDaily: 0,
    daysRemaining: isCurrent ? Math.max(0, totalDays - currentDay(env.APP_TIMEZONE, now)) : 0,
    remainingDaysIncludingToday: isCurrent ? Math.max(1, totalDays - currentDay(env.APP_TIMEZONE, now) + 1) : 0,
    monthEndsAt: selectedRange.monthEnd.toISOString()
  };

  if (!store) {
    return {
      connected: false,
      month,
      trackedStatus: env.trackedStatus,
      period: {
        start: selectedRange.start.toISOString(),
        end: selectedRange.end.toISOString()
      },
      store: null,
      summary: emptySummary,
      goals: emptyGoals(),
      chart: [],
      recentOrders: [],
      sync: null
    };
  }

  const where: Prisma.OrderWhereInput = {
    storeRecordId: store.id,
    orderDate: { gte: selectedRange.start, lt: selectedRange.end },
    ...(env.trackAllStatuses
      ? {}
      : { status: { in: env.trackedStatuses, mode: "insensitive" as const } })
  };

  const [orders, goalLevels, recentOrders, lastSync] = await Promise.all([
    prisma.order.findMany({
      where,
      select: { orderDate: true },
      orderBy: { orderDate: "asc" }
    }),
    ensureGoalLevels(store.id, month),
    prisma.order.findMany({
      where,
      orderBy: [{ modifiedAt: "desc" }, { orderDate: "desc" }, { trayOrderId: "desc" }],
      take: 8,
      select: {
        trayOrderId: true,
        orderDate: true,
        modifiedAt: true,
        status: true,
        total: true,
        pointSale: true,
        externalCode: true
      }
    }),
    prisma.syncLog.findFirst({
      where: { storeRecordId: store.id },
      orderBy: { startedAt: "desc" },
      select: { status: true, startedAt: true, finishedAt: true, items: true, message: true }
    })
  ]);

  const counts = Array.from({ length: totalDays }, () => 0);
  orders.forEach((order) => {
    const day = dayInTimeZone(order.orderDate, env.APP_TIMEZONE);
    if (day >= 1 && day <= totalDays) counts[day - 1] = (counts[day - 1] ?? 0) + 1;
  });

  const levelViews = goalLevels.map((level) => ({
    id: level.id,
    position: level.position,
    label: level.label,
    targetOrders: level.targetOrders,
    achieved: Boolean(level.achievement),
    achievedAt: level.achievement?.achievedAt ?? null
  }));
  const completedCount = levelViews.filter((level) => level.achieved).length;
  const allCompleted = levelViews.length > 0 && completedCount === levelViews.length;
  const activeLevel = levelViews.find((level) => !level.achieved) ?? levelViews.at(-1) ?? null;
  const activeIndex = activeLevel ? levelViews.findIndex((level) => level.id === activeLevel.id) : -1;
  const nextLevel = activeIndex >= 0 ? levelViews[activeIndex + 1] ?? null : null;
  const previousTarget = activeIndex > 0 ? levelViews[activeIndex - 1]?.targetOrders ?? 0 : 0;
  const goalValue = activeLevel?.targetOrders ?? 0;

  const today = isCurrent ? Math.max(1, Math.min(totalDays, currentDay(env.APP_TIMEZONE, now))) : totalDays;
  let cumulative = 0;
  const chart = counts.map((count, index) => {
    cumulative += count;
    const day = index + 1;
    return {
      day,
      orders: !isCurrent || day <= today ? cumulative : null,
      dailyOrders: !isCurrent || day <= today ? count : null,
      target: goalValue > 0 ? Math.round((goalValue / totalDays) * day) : 0
    };
  });

  const elapsedDays = isCurrent ? today : totalDays;
  const dailyAverage = orders.length / Math.max(1, elapsedDays);
  const projectedOrders = Math.round(dailyAverage * totalDays);
  const progress = allCompleted
    ? 100
    : goalValue > 0
      ? Math.min(100, (orders.length / goalValue) * 100)
      : 0;
  const stageProgress = allCompleted
    ? 100
    : activeLevel
      ? Math.max(0, Math.min(100, ((orders.length - previousTarget) / Math.max(1, activeLevel.targetOrders - previousTarget)) * 100))
      : 0;
  const remaining = Math.max(0, goalValue - orders.length);
  const remainingDaysIncludingToday = isCurrent ? Math.max(1, totalDays - today + 1) : 0;
  const requiredDaily = goalValue > 0 && remaining > 0 && remainingDaysIncludingToday > 0
    ? Math.ceil(remaining / remainingDaysIncludingToday)
    : 0;

  return {
    connected: true,
    month,
    trackedStatus: env.trackedStatus,
    period: {
      start: selectedRange.start.toISOString(),
      end: selectedRange.end.toISOString()
    },
    store: {
      id: store.id,
      storeId: store.storeId,
      storeHost: store.storeHost,
      apiAddress: store.apiAddress,
      lastSyncAt: store.lastSyncAt,
      tokenExpiresAt: store.accessTokenExpiresAt
    },
    summary: {
      orders: orders.length,
      goal: goalValue,
      goalLabel: activeLevel?.label ?? "Nenhuma meta",
      progress: Number(progress.toFixed(1)),
      remaining,
      dailyAverage: Number(dailyAverage.toFixed(1)),
      projectedOrders,
      requiredDaily,
      daysRemaining: isCurrent ? Math.max(0, totalDays - today) : 0,
      remainingDaysIncludingToday,
      monthEndsAt: selectedRange.monthEnd.toISOString()
    },
    goals: {
      levels: levelViews,
      activeLevel,
      nextLevel,
      completedCount,
      totalCount: levelViews.length,
      allCompleted,
      stageProgress: Number(stageProgress.toFixed(1))
    },
    chart,
    recentOrders: recentOrders.map((order) => ({
      ...order,
      total: Number(order.total)
    })),
    sync: lastSync
  };
}
