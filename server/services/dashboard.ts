import type { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../db";
import { currentDay, currentMonth, dayInTimeZone, daysInMonth, monthRangeUtc, parseMonthKey } from "../utils/date";

export async function getDefaultStore() {
  return prisma.trayStore.findFirst({
    where: { active: true },
    orderBy: { installedAt: "asc" }
  });
}

export async function buildDashboardData(month = currentMonth(), storeRecordId?: string) {
  const parts = parseMonthKey(month);
  const store = storeRecordId
    ? await prisma.trayStore.findUnique({ where: { id: storeRecordId } })
    : await getDefaultStore();

  if (!store) {
    return {
      connected: false,
      month,
      store: null,
      summary: {
        orders: 0,
        goal: 0,
        progress: 0,
        remaining: 0,
        dailyAverage: 0,
        projectedOrders: 0
      },
      chart: [],
      recentOrders: [],
      sync: null
    };
  }

  const { start, end } = monthRangeUtc(parts);
  const where: Prisma.OrderWhereInput = {
    storeRecordId: store.id,
    orderDate: { gte: start, lt: end }
  };

  if (env.excludedStatuses.length) {
    where.status = { notIn: env.excludedStatuses, mode: "insensitive" };
  }

  const [orders, goal, recentOrders, lastSync] = await Promise.all([
    prisma.order.findMany({
      where,
      select: { orderDate: true },
      orderBy: { orderDate: "asc" }
    }),
    prisma.goal.findUnique({
      where: {
        storeRecordId_year_month: {
          storeRecordId: store.id,
          year: parts.year,
          month: parts.month
        }
      }
    }),
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

  const totalDays = daysInMonth(parts);
  const counts = Array.from({ length: totalDays }, () => 0);
  orders.forEach((order) => {
    const day = dayInTimeZone(order.orderDate, env.APP_TIMEZONE);
    if (day >= 1 && day <= totalDays) counts[day - 1] = (counts[day - 1] ?? 0) + 1;
  });

  let cumulative = 0;
  const goalValue = goal?.targetOrders ?? 0;
  const chart = counts.map((count, index) => {
    cumulative += count;
    const day = index + 1;
    return {
      day,
      orders: cumulative,
      dailyOrders: count,
      target: goalValue > 0 ? Math.round((goalValue / totalDays) * day) : 0
    };
  });

  const isCurrent = month === currentMonth(env.APP_TIMEZONE);
  const elapsedDays = isCurrent ? Math.max(1, Math.min(totalDays, currentDay(env.APP_TIMEZONE))) : totalDays;
  const dailyAverage = orders.length / elapsedDays;
  const projectedOrders = Math.round(dailyAverage * totalDays);
  const progress = goalValue > 0 ? Math.min(999, (orders.length / goalValue) * 100) : 0;

  return {
    connected: true,
    month,
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
      progress: Number(progress.toFixed(1)),
      remaining: Math.max(0, goalValue - orders.length),
      dailyAverage: Number(dailyAverage.toFixed(1)),
      projectedOrders
    },
    chart,
    recentOrders: recentOrders.map((order) => ({
      ...order,
      total: Number(order.total)
    })),
    sync: lastSync
  };
}
