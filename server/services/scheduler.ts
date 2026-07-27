import cron from "node-cron";
import { env } from "../config/env";
import { prisma } from "../db";
import { automaticSyncPhase, currentMonth, isAutomaticSyncWindow, todayRangeUtc } from "../utils/date";
import { processPendingWebhookEvent, syncMonth, syncToday, type SyncScope } from "./order-sync";
import { recoverInactiveTrayStores } from "./tray-client";

const runningStores = new Set<string>();

const AUTOMATIC_SCHEDULES = {
  tokenRecovery: "37 7 * * 1-5",
  opening: "42 7 * * 1-5",
  morning: "45-59/3 7 * * 1-5",
  intraday: "*/3 8-17 * * 1-5",
  closing: "0 18 * * 1-5"
} as const;

type AutomaticReason = "opening" | "intraday" | "closing" | "startup";

async function syncActiveStores(scope: SyncScope, reason: AutomaticReason): Promise<void> {
  const stores = await prisma.trayStore.findMany({ where: { active: true } });

  for (const store of stores) {
    if (runningStores.has(store.id)) continue;
    runningStores.add(store.id);
    try {
      const options = {
        broadcast: "count-only" as const,
        source: "scheduler" as const,
        reason
      };
      const result = scope === "today"
        ? await syncToday(store, options)
        : await syncMonth(store, currentMonth(env.APP_TIMEZONE), { ...options, scope: "month" });
      console.log(
        `[sync:auto:${scope}:${reason}] loja ${store.storeId} · período ${result.period.startDate} a ${result.period.endDate} · páginas ${result.pages} · itens ${result.items} · total ${result.liveUpdate.orders} · variação ${result.liveUpdate.delta >= 0 ? "+" : ""}${result.liveUpdate.delta}`
      );
    } catch (error) {
      console.error(
        `Falha no sync ${scope}/${reason} da loja ${store.storeId}:`,
        error instanceof Error ? error.message : error
      );
    } finally {
      runningStores.delete(store.id);
    }
  }
}

async function hasFullReconciliationToday(storeRecordId: string): Promise<boolean> {
  const range = todayRangeUtc(env.APP_TIMEZONE);
  const log = await prisma.syncLog.findFirst({
    where: {
      storeRecordId,
      status: "success",
      kind: { startsWith: `month:${currentMonth(env.APP_TIMEZONE)}:` },
      startedAt: { gte: range.start, lt: range.end }
    },
    select: { id: true }
  });
  return Boolean(log);
}

async function startupSync(): Promise<void> {
  const phase = automaticSyncPhase(env.APP_TIMEZONE);
  if (!isAutomaticSyncWindow(env.APP_TIMEZONE) && phase !== "closing") return;
  const stores = await prisma.trayStore.findMany({ where: { active: true } });

  for (const store of stores) {
    if (runningStores.has(store.id)) continue;
    const fullAlreadyRan = phase === "closing" ? false : await hasFullReconciliationToday(store.id);
    runningStores.add(store.id);
    try {
      const result = fullAlreadyRan
        ? await syncToday(store, { broadcast: "count-only", source: "scheduler", reason: "startup" })
        : await syncMonth(store, currentMonth(env.APP_TIMEZONE), {
            broadcast: "count-only",
            source: "scheduler",
            scope: "month",
            reason: phase === "closing" ? "closing" : "startup"
          });
      console.log(
        `[sync:auto:startup] loja ${store.storeId} · modo ${fullAlreadyRan ? "today" : "month"} · páginas ${result.pages} · itens ${result.items} · total ${result.liveUpdate.orders}`
      );
    } catch (error) {
      console.error(`Falha no sync inicial da loja ${store.storeId}:`, error instanceof Error ? error.message : error);
    } finally {
      runningStores.delete(store.id);
    }
  }
}

async function retryPendingWebhooks(): Promise<void> {
  const now = new Date();

  await prisma.webhookEvent.updateMany({
    where: {
      status: "processing",
      lastAttemptAt: { lt: new Date(now.getTime() - 10 * 60_000) }
    },
    data: { status: "retry", nextAttemptAt: now }
  });

  const events = await prisma.webhookEvent.findMany({
    where: {
      status: { in: ["pending", "retry"] },
      receivedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
    },
    orderBy: { receivedAt: "asc" },
    take: 30,
    select: { id: true }
  });

  for (const event of events) {
    try {
      await processPendingWebhookEvent(event.id);
    } catch (error) {
      console.error("Webhook pendente ainda falhou:", error instanceof Error ? error.message : error);
    }
  }
}

export function startScheduler(): void {
  for (const [name, expression] of Object.entries(AUTOMATIC_SCHEDULES)) {
    if (!cron.validate(expression)) throw new Error(`Cron automático inválido (${name}): ${expression}`);
  }

  console.log(
    `[sync:auto] seg-sex · reconciliação mensal 07:42 e 18:00 · pedidos de hoje a cada 3 minutos · fuso ${env.APP_TIMEZONE}.`
  );

  cron.schedule(AUTOMATIC_SCHEDULES.tokenRecovery, () => {
    void recoverInactiveTrayStores();
  }, { timezone: env.APP_TIMEZONE });

  cron.schedule(AUTOMATIC_SCHEDULES.opening, () => {
    void syncActiveStores("month", "opening");
  }, { timezone: env.APP_TIMEZONE });

  cron.schedule(AUTOMATIC_SCHEDULES.morning, () => {
    void syncActiveStores("today", "intraday");
  }, { timezone: env.APP_TIMEZONE });

  cron.schedule(AUTOMATIC_SCHEDULES.intraday, () => {
    void syncActiveStores("today", "intraday");
  }, { timezone: env.APP_TIMEZONE });

  cron.schedule(AUTOMATIC_SCHEDULES.closing, () => {
    void syncActiveStores("month", "closing");
  }, { timezone: env.APP_TIMEZONE });

  cron.schedule("* * * * *", () => {
    void retryPendingWebhooks();
  }, { timezone: env.APP_TIMEZONE });

  setTimeout(() => {
    void retryPendingWebhooks();
    void recoverInactiveTrayStores()
      .catch((error) => {
        console.error("Falha ao verificar autorizações Tray inativas:", error instanceof Error ? error.message : error);
      })
      .finally(() => {
        void startupSync();
      });
  }, 5_000).unref();
}
