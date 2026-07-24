import cron from "node-cron";
import { env } from "../config/env";
import { prisma } from "../db";
import { currentMonth } from "../utils/date";
import { processPendingWebhookEvent, syncMonth } from "./order-sync";

const runningStores = new Set<string>();

async function syncActiveStores(): Promise<void> {
  const stores = await prisma.trayStore.findMany({ where: { active: true } });

  for (const store of stores) {
    if (runningStores.has(store.id)) continue;
    runningStores.add(store.id);
    try {
      await syncMonth(store, currentMonth(env.APP_TIMEZONE));
    } catch (error) {
      console.error(`Falha no sync da loja ${store.storeId}:`, error instanceof Error ? error.message : error);
    } finally {
      runningStores.delete(store.id);
    }
  }
}

async function retryPendingWebhooks(): Promise<void> {
  const now = new Date();

  // Recupera eventos que ficaram presos caso o processo tenha reiniciado durante o tratamento.
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
  if (!cron.validate(env.SYNC_CRON)) {
    throw new Error(`SYNC_CRON inválido: ${env.SYNC_CRON}`);
  }

  cron.schedule(env.SYNC_CRON, () => {
    void syncActiveStores();
  }, { timezone: env.APP_TIMEZONE });

  cron.schedule("* * * * *", () => {
    void retryPendingWebhooks();
  }, { timezone: env.APP_TIMEZONE });

  setTimeout(() => {
    void retryPendingWebhooks();
    void syncActiveStores();
  }, 5_000).unref();
}
