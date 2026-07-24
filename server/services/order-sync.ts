import type { TrayStore } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../db";
import {
  currentMonth,
  liveMonthRangeUtc,
  monthRangeUtc,
  parseMonthKey,
  parseTrayDate,
  parseTrayDateTime,
  trayLiveMonthRange,
  trayMonthRange
} from "../utils/date";
import { buildDashboardData } from "./dashboard";
import { emitDashboardUpdate, emitNewOrder } from "./realtime";
import { trayRequest } from "./tray-client";

export type TrayOrder = {
  id: string | number;
  status?: string;
  date?: string;
  hour?: string;
  total?: string | number;
  modified?: string;
  point_sale?: string;
  external_code?: string;
  customer_id?: string | number;
  OrderStatus?: {
    type?: string;
    status?: string;
  };
  [key: string]: unknown;
};

type TrayOrdersResponse = {
  paging?: {
    total?: number;
    page?: number;
    limit?: number;
    maxLimit?: number;
  };
  Orders?: Array<{ Order: TrayOrder }>;
};

type TrayOrderResponse = {
  Order?: TrayOrder;
};

const MAX_MONTH_PAGES = 500;
const UPSERT_CONCURRENCY = 10;
const MAX_WEBHOOK_ATTEMPTS = 8;

function normalizeStatus(order: TrayOrder): string {
  return String(order.status || order.OrderStatus?.status || "SEM STATUS").trim().toUpperCase();
}

function isTrackedStatus(order: TrayOrder): boolean {
  return env.trackAllStatuses || env.trackedStatuses.includes(normalizeStatus(order));
}

function normalizeWebhookAction(action: string): string {
  return action.trim().toLowerCase().replace(/^order_/, "");
}

function orderDate(order: TrayOrder): Date {
  return parseTrayDate(order.date, order.hour, env.APP_TIMEZONE);
}

function isInsideRange(order: TrayOrder, start: Date, end: Date): boolean {
  const date = orderDate(order);
  return date >= start && date < end;
}

async function inBatches<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker));
  }
}

export async function upsertTrayOrder(store: TrayStore, order: TrayOrder, detectNew = true) {
  const trayOrderId = String(order.id);
  const existing = detectNew
    ? await prisma.order.findUnique({
        where: {
          storeRecordId_trayOrderId: {
            storeRecordId: store.id,
            trayOrderId
          }
        },
        select: { id: true }
      })
    : null;

  const numericTotal = Number(order.total || 0);
  const data = {
    orderDate: orderDate(order),
    modifiedAt: parseTrayDateTime(order.modified, env.APP_TIMEZONE),
    status: normalizeStatus(order),
    statusType: order.OrderStatus?.type ? String(order.OrderStatus.type) : null,
    total: Number.isFinite(numericTotal) ? numericTotal : 0,
    pointSale: order.point_sale ? String(order.point_sale) : null,
    externalCode: order.external_code ? String(order.external_code) : null,
    customerId: order.customer_id ? String(order.customer_id) : null,
    raw: order as never
  };

  const saved = await prisma.order.upsert({
    where: {
      storeRecordId_trayOrderId: {
        storeRecordId: store.id,
        trayOrderId
      }
    },
    create: {
      storeRecordId: store.id,
      trayOrderId,
      ...data
    },
    update: data
  });

  return { saved, isNew: detectNew && !existing };
}

async function removeOrderAndRefresh(store: TrayStore, orderId: string, reason: string) {
  const removed = await prisma.order.deleteMany({
    where: { storeRecordId: store.id, trayOrderId: orderId }
  });

  await prisma.trayStore.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });

  if (removed.count > 0) {
    const dashboard = await buildDashboardData(currentMonth(env.APP_TIMEZONE), store.id);
    emitDashboardUpdate(dashboard);
  }

  return { ignored: true, removed: removed.count, reason };
}

export async function syncOrderById(store: TrayStore, orderId: string, rawAction = "update") {
  const action = normalizeWebhookAction(rawAction);

  if (action === "delete") {
    return removeOrderAndRefresh(store, orderId, "Pedido excluído na Tray.");
  }

  const response = await trayRequest<TrayOrderResponse>(store, `/orders/${encodeURIComponent(orderId)}/complete`);
  if (!response.Order) throw new Error(`Pedido ${orderId} não retornado pela Tray.`);

  const liveRange = liveMonthRangeUtc(env.APP_TIMEZONE);

  if (!isTrackedStatus(response.Order)) {
    return removeOrderAndRefresh(
      store,
      orderId,
      `Status ${normalizeStatus(response.Order)} não está entre os monitorados: ${env.trackedStatus}.`
    );
  }

  if (!isInsideRange(response.Order, liveRange.start, liveRange.end)) {
    return removeOrderAndRefresh(store, orderId, "Pedido fora do período ao vivo do mês atual.");
  }

  const result = await upsertTrayOrder(store, response.Order, true);
  await prisma.trayStore.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });

  const dashboard = await buildDashboardData(currentMonth(env.APP_TIMEZONE), store.id);
  emitDashboardUpdate(dashboard);

  if (result.isNew) {
    emitNewOrder({
      trayOrderId: result.saved.trayOrderId,
      total: Number(result.saved.total),
      status: result.saved.status,
      occurredAt: result.saved.orderDate
    });
  }

  return result;
}

export async function syncMonth(store: TrayStore, month = currentMonth(env.APP_TIMEZONE)) {
  const parts = parseMonthKey(month);
  const isCurrent = month === currentMonth(env.APP_TIMEZONE);
  const apiRange = isCurrent
    ? trayLiveMonthRange(env.APP_TIMEZONE)
    : (() => {
        const range = trayMonthRange(parts);
        return { ...range, endDate: `${range.endDate} 23:59:59` };
      })();
  const fullMonthRange = monthRangeUtc(parts, env.APP_TIMEZONE);
  const databaseRange = isCurrent
    ? liveMonthRangeUtc(env.APP_TIMEZONE)
    : { ...fullMonthRange, monthEnd: fullMonthRange.end };
  const syncStartedAt = new Date();
  const log = await prisma.syncLog.create({
    data: { storeRecordId: store.id, kind: `month:${month}:status:${env.trackedStatus}`, status: "running" }
  });

  let pages = 0;
  let items = 0;
  const syncedOrderIds = new Set<string>();

  try {
    // STATUS=* busca todos os pedidos do período em uma única paginação.
    // Quando há uma lista, a API recebe um status por requisição e consolidamos por ID.
    const statusQueries: Array<string | undefined> = env.trackAllStatuses
      ? [undefined]
      : env.trackedStatuses;

    for (const trackedStatus of statusQueries) {
      let page = 1;

      while (page <= MAX_MONTH_PAGES) {
        const response = await trayRequest<TrayOrdersResponse>(store, "/orders", {
          status: trackedStatus,
          date: `${apiRange.startDate},${apiRange.endDate}`,
          limit: 50,
          page,
          sort: "id_asc"
        });

        const pageOrders = (response.Orders ?? [])
          .map((wrapper) => wrapper.Order)
          .filter((order): order is TrayOrder => order?.id !== undefined)
          // Filtros defensivos caso uma loja ou versão da API ignore algum parâmetro.
          .filter((order) => isTrackedStatus(order))
          .filter((order) => isInsideRange(order, databaseRange.start, databaseRange.end));

        await inBatches(pageOrders, UPSERT_CONCURRENCY, async (order) => {
          syncedOrderIds.add(String(order.id));
          await upsertTrayOrder(store, order, false);
        });
        pages += 1;

        const total = Number(response.paging?.total ?? 0);
        const limit = Math.max(1, Number(response.paging?.limit ?? 50));
        const expectedPages = Math.max(1, Math.ceil(total / limit));

        if (expectedPages > MAX_MONTH_PAGES) {
          throw new Error(
            `${trackedStatus ? `O status ${trackedStatus}` : "A busca de todos os status"} possui ${expectedPages} páginas, acima do limite de segurança de ${MAX_MONTH_PAGES}.`
          );
        }

        if ((response.Orders ?? []).length === 0 || page >= expectedPages) break;
        page += 1;
      }
    }

    items = syncedOrderIds.size;

    // Remove registros do período que não vieram na reconciliação. Quando STATUS não é "*",
    // também elimina pedidos que deixaram a lista de status monitorados.
    await prisma.order.deleteMany({
      where: {
        storeRecordId: store.id,
        orderDate: { gte: databaseRange.start, lt: databaseRange.end },
        ...(env.trackAllStatuses
          ? { updatedAt: { lt: syncStartedAt } }
          : {
              OR: [
                { status: { notIn: env.trackedStatuses, mode: "insensitive" } },
                { updatedAt: { lt: syncStartedAt } }
              ]
            })
      }
    });

    await Promise.all([
      prisma.trayStore.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } }),
      prisma.syncLog.update({
        where: { id: log.id },
        data: {
          status: "success",
          items,
          pages,
          message: `Status monitorados: ${env.trackedStatus}; período ${apiRange.startDate} até ${apiRange.endDate}.`,
          finishedAt: new Date()
        }
      })
    ]);

    const dashboard = await buildDashboardData(month, store.id);
    emitDashboardUpdate(dashboard);
    return {
      items,
      pages,
      statuses: env.trackAllStatuses ? ["*"] : env.trackedStatuses,
      period: apiRange,
      dashboard
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "error", items, pages, message, finishedAt: new Date() }
    });
    throw error;
  }
}

function retryDelayMs(attempt: number): number {
  return Math.min(15 * 60_000, 15_000 * 2 ** Math.max(0, attempt - 1));
}

export async function processPendingWebhookEvent(eventId: string): Promise<void> {
  const now = new Date();
  const claimed = await prisma.webhookEvent.updateMany({
    where: {
      id: eventId,
      status: { in: ["pending", "retry"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
    },
    data: {
      status: "processing",
      attempts: { increment: 1 },
      lastAttemptAt: now
    }
  });

  if (claimed.count === 0) return;

  const event = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
    include: { store: true }
  });

  if (!event) return;

  if (!event.store) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "ignored", error: "Loja não autorizada.", processedAt: new Date(), nextAttemptAt: null }
    });
    return;
  }

  try {
    let ignoredReason: string | null = null;

    if (event.scopeName.toLowerCase() === "order") {
      const result = await syncOrderById(event.store, event.scopeId, event.action);
      if ("ignored" in result && result.ignored) ignoredReason = result.reason;
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: ignoredReason ? "ignored" : "processed",
        processedAt: new Date(),
        error: ignoredReason,
        nextAttemptAt: null
      }
    });
  } catch (error) {
    const terminal = event.attempts >= MAX_WEBHOOK_ATTEMPTS;
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: terminal ? "error" : "retry",
        error: error instanceof Error ? error.message.slice(0, 1000) : "Erro desconhecido",
        processedAt: terminal ? new Date() : null,
        nextAttemptAt: terminal ? null : new Date(Date.now() + retryDelayMs(event.attempts))
      }
    });
    throw error;
  }
}
