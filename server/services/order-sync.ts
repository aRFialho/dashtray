import type { TrayStore } from "@prisma/client";
import { prisma } from "../db";
import { currentMonth, parseMonthKey, parseTrayDate, parseTrayDateTime, trayMonthRange } from "../utils/date";
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

function normalizeWebhookAction(action: string): string {
  return action.trim().toLowerCase().replace(/^order_/, "");
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
    orderDate: parseTrayDate(order.date, order.hour),
    modifiedAt: parseTrayDateTime(order.modified),
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

export async function syncOrderById(store: TrayStore, orderId: string, rawAction = "update") {
  const action = normalizeWebhookAction(rawAction);

  if (action === "delete") {
    await prisma.order.deleteMany({
      where: { storeRecordId: store.id, trayOrderId: orderId }
    });
    const dashboard = await buildDashboardData(currentMonth(), store.id);
    emitDashboardUpdate(dashboard);
    return { deleted: true };
  }

  const response = await trayRequest<TrayOrderResponse>(store, `/orders/${encodeURIComponent(orderId)}/complete`);
  if (!response.Order) throw new Error(`Pedido ${orderId} não retornado pela Tray.`);

  const result = await upsertTrayOrder(store, response.Order, true);
  await prisma.trayStore.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });

  const dashboard = await buildDashboardData(currentMonth(), store.id);
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

export async function syncMonth(store: TrayStore, month = currentMonth()) {
  const parts = parseMonthKey(month);
  const range = trayMonthRange(parts);
  const log = await prisma.syncLog.create({
    data: { storeRecordId: store.id, kind: `month:${month}`, status: "running" }
  });

  let page = 1;
  let pages = 0;
  let items = 0;

  try {
    while (page <= MAX_MONTH_PAGES) {
      const response = await trayRequest<TrayOrdersResponse>(store, "/orders", {
        date: `${range.startDate},${range.endDate}`,
        limit: 50,
        page,
        sort: "id_asc"
      });

      const pageOrders = (response.Orders ?? [])
        .map((wrapper) => wrapper.Order)
        .filter((order): order is TrayOrder => order?.id !== undefined);

      await inBatches(pageOrders, UPSERT_CONCURRENCY, async (order) => {
        await upsertTrayOrder(store, order, false);
      });
      items += pageOrders.length;
      pages += 1;

      const total = Number(response.paging?.total ?? 0);
      const limit = Math.max(1, Number(response.paging?.limit ?? 50));
      const expectedPages = Math.max(1, Math.ceil(total / limit));

      if (expectedPages > MAX_MONTH_PAGES) {
        throw new Error(`O mês possui ${expectedPages} páginas, acima do limite de segurança de ${MAX_MONTH_PAGES}.`);
      }

      if (pageOrders.length === 0 || page >= expectedPages) break;
      page += 1;
    }

    await Promise.all([
      prisma.trayStore.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } }),
      prisma.syncLog.update({
        where: { id: log.id },
        data: { status: "success", items, pages, finishedAt: new Date() }
      })
    ]);

    const dashboard = await buildDashboardData(month, store.id);
    emitDashboardUpdate(dashboard);
    return { items, pages, dashboard };
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
    if (event.scopeName.toLowerCase() === "order") {
      await syncOrderById(event.store, event.scopeId, event.action);
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "processed",
        processedAt: new Date(),
        error: null,
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
