import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../db";
import { requireAdmin } from "../middleware/auth";
import { buildDashboardData, getDefaultStore } from "../services/dashboard";
import { processPendingWebhookEvent, syncMonth } from "../services/order-sync";
import {
  buildTrayAuthorizationUrl,
  exchangeAuthorizationCode
} from "../services/tray-client";
import { asyncHandler } from "../utils/async-handler";
import { currentMonth } from "../utils/date";
import { HttpError } from "../utils/http-error";

const apiRouter = Router();
const publicRouter = Router();

function safeTokenEquals(received: unknown, expected: string): boolean {
  if (typeof received !== "string") return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const connectSchema = z.object({
  apiAddress: z.string().url(),
  code: z.string().min(16).max(500),
  storeHost: z.string().url().optional(),
  adminUser: z.string().max(200).optional()
});

const webhookStatusSchema = z.enum(["all", "pending", "processing", "processed", "retry", "error", "ignored"]);

async function buildWebhookManagement(status = "all") {
  const store = await getDefaultStore();
  const endpointUrl = `${env.APP_URL}/api/tray/webhook${
    env.TRAY_WEBHOOK_TOKEN ? `?token=${encodeURIComponent(env.TRAY_WEBHOOK_TOKEN)}` : ""
  }`;

  if (!store) {
    return {
      connected: false,
      endpointUrl,
      tokenProtected: Boolean(env.TRAY_WEBHOOK_TOKEN),
      activationObserved: false,
      state: "disconnected",
      stats: { total: 0, last24h: 0, pending: 0, processing: 0, processed: 0, retry: 0, error: 0, ignored: 0 },
      lastReceivedAt: null,
      events: []
    };
  }

  const baseWhere = { storeRecordId: store.id } as const;
  const eventWhere = status === "all"
    ? baseWhere
    : { ...baseWhere, status };
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const statuses = ["pending", "processing", "processed", "retry", "error", "ignored"] as const;

  const [events, total, last24h, lastEvent, lastExternalEvent] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: eventWhere,
      orderBy: { receivedAt: "desc" },
      take: 50,
      select: {
        id: true,
        sellerId: true,
        scopeName: true,
        scopeId: true,
        action: true,
        status: true,
        attempts: true,
        error: true,
        nextAttemptAt: true,
        lastAttemptAt: true,
        receivedAt: true,
        processedAt: true
      }
    }),
    prisma.webhookEvent.count({ where: baseWhere }),
    prisma.webhookEvent.count({ where: { ...baseWhere, receivedAt: { gte: last24Hours } } }),
    prisma.webhookEvent.findFirst({
      where: baseWhere,
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true, status: true }
    }),
    prisma.webhookEvent.findFirst({
      where: { ...baseWhere, scopeName: { not: "diagnostic" } },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true }
    })
  ]);
  const statusCounts = await Promise.all(
    statuses.map((eventStatus) => prisma.webhookEvent.count({ where: { ...baseWhere, status: eventStatus } }))
  );

  const stats = statuses.reduce<Record<string, number>>((accumulator, eventStatus, index) => {
    accumulator[eventStatus] = statusCounts[index] ?? 0;
    return accumulator;
  }, { total, last24h });

  const attention = (stats.error ?? 0) + (stats.retry ?? 0) > 0;
  const state = attention ? "attention" : lastExternalEvent ? "receiving" : "waiting";

  return {
    connected: true,
    endpointUrl,
    tokenProtected: Boolean(env.TRAY_WEBHOOK_TOKEN),
    activationObserved: Boolean(lastExternalEvent),
    state,
    stats,
    lastReceivedAt: lastEvent?.receivedAt ?? null,
    events
  };
}

apiRouter.get(
  "/status",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const store = await getDefaultStore();
    res.json({
      connected: Boolean(store),
      store: store
        ? {
            storeId: store.storeId,
            storeHost: store.storeHost,
            apiAddress: store.apiAddress,
            active: store.active,
            installedAt: store.installedAt,
            lastSyncAt: store.lastSyncAt,
            tokenExpiresAt: store.accessTokenExpiresAt
          }
        : null,
      callbackUrl: `${env.APP_URL}/tray/callback`,
      authCallbackUrl: `${env.APP_URL}/tray/callback/auth`,
      webhookUrl: `${env.APP_URL}/api/tray/webhook${
        env.TRAY_WEBHOOK_TOKEN ? `?token=${encodeURIComponent(env.TRAY_WEBHOOK_TOKEN)}` : ""
      }`
    });
  })
);

apiRouter.get(
  "/webhooks",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = webhookStatusSchema.parse(typeof req.query.status === "string" ? req.query.status : "all");
    res.json(await buildWebhookManagement(status));
  })
);

apiRouter.post(
  "/webhooks/test",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const store = await getDefaultStore();
    if (!store) throw new HttpError(409, "Conecte uma loja antes de testar o pipeline de webhooks.");

    const now = new Date();
    await prisma.webhookEvent.create({
      data: {
        storeRecordId: store.id,
        sellerId: store.storeId,
        scopeName: "diagnostic",
        scopeId: String(now.getTime()),
        action: "test",
        fingerprint: crypto.randomBytes(32).toString("hex"),
        payload: { source: "admin", type: "pipeline-test" },
        status: "processed",
        attempts: 1,
        lastAttemptAt: now,
        receivedAt: now,
        processedAt: now
      }
    });

    res.status(201).json({
      message: "Pipeline interno registrado com sucesso.",
      management: await buildWebhookManagement()
    });
  })
);

apiRouter.post(
  "/webhooks/retry-failed",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const store = await getDefaultStore();
    if (!store) throw new HttpError(409, "Nenhuma loja conectada.");

    const events = await prisma.webhookEvent.findMany({
      where: { storeRecordId: store.id, status: { in: ["error", "retry"] } },
      orderBy: { receivedAt: "asc" },
      take: 50,
      select: { id: true }
    });

    if (events.length > 0) {
      await prisma.webhookEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: { status: "pending", attempts: 0, error: null, nextAttemptAt: null, processedAt: null }
      });

      setImmediate(async () => {
        for (const event of events) {
          try {
            await processPendingWebhookEvent(event.id);
          } catch (error) {
            console.error("Falha ao reprocessar webhook:", error instanceof Error ? error.message : error);
          }
        }
      });
    }

    res.json({ queued: events.length, management: await buildWebhookManagement() });
  })
);

apiRouter.post(
  "/webhooks/:id/reprocess",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const store = await getDefaultStore();
    if (!store) throw new HttpError(409, "Nenhuma loja conectada.");

    const rawEventId = req.params.id;
    const eventId = Array.isArray(rawEventId) ? rawEventId[0] : rawEventId;
    if (!eventId) throw new HttpError(400, "ID do evento webhook inválido.");

    const event = await prisma.webhookEvent.findFirst({
      where: { id: eventId, storeRecordId: store.id },
      select: { id: true }
    });
    if (!event) throw new HttpError(404, "Evento webhook não encontrado.");

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "pending", attempts: 0, error: null, nextAttemptAt: null, processedAt: null }
    });

    setImmediate(() => {
      processPendingWebhookEvent(event.id).catch((error) => {
        console.error("Falha ao reprocessar webhook:", error instanceof Error ? error.message : error);
      });
    });

    res.json({ queued: true, management: await buildWebhookManagement() });
  })
);

apiRouter.post(
  "/connect",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = connectSchema.parse(req.body);
    const store = await exchangeAuthorizationCode(input);
    const result = await syncMonth(store, currentMonth());
    res.status(201).json({
      connected: true,
      store: { storeId: store.storeId, apiAddress: store.apiAddress },
      dashboard: result.dashboard
    });
  })
);

apiRouter.post(
  "/authorization-url",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = z.object({ storeHost: z.string().url() }).parse(req.body);
    const url = buildTrayAuthorizationUrl({
      storeHost: input.storeHost,
      callbackUrl: `${env.APP_URL}/tray/callback/auth`
    });
    res.json({ url });
  })
);

apiRouter.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    if (env.TRAY_WEBHOOK_TOKEN && !safeTokenEquals(req.query.token, env.TRAY_WEBHOOK_TOKEN)) {
      throw new HttpError(401, "Webhook não autorizado.");
    }

    const payload = z
      .object({
        seller_id: z.coerce.string().min(1),
        scope_id: z.coerce.string().min(1),
        scope_name: z.coerce.string().min(1),
        act: z.coerce.string().min(1),
        app_code: z.coerce.string().optional(),
        url_notification: z.coerce.string().optional()
      })
      .passthrough()
      .parse(req.body);

    const store = await prisma.trayStore.findUnique({ where: { storeId: payload.seller_id } });
    const bucket = Math.floor(Date.now() / 30_000);
    const fingerprint = crypto
      .createHash("sha256")
      .update(`${payload.seller_id}:${payload.scope_name}:${payload.scope_id}:${payload.act}:${bucket}`)
      .digest("hex");

    const event = await prisma.webhookEvent.upsert({
      where: { fingerprint },
      create: {
        storeRecordId: store?.id,
        sellerId: payload.seller_id,
        scopeName: payload.scope_name,
        scopeId: payload.scope_id,
        action: payload.act,
        fingerprint,
        payload: payload as never
      },
      update: {}
    });

    res.status(200).json({ received: true });

    setImmediate(() => {
      processPendingWebhookEvent(event.id).catch((error) => {
        console.error("Falha ao processar webhook Tray:", error instanceof Error ? error.message : error);
      });
    });
  })
);

publicRouter.get(
  "/callback",
  asyncHandler(async (req, res) => {
    const storeHost = z.string().url().parse(req.query.url || req.query.store_host);
    const store = typeof req.query.store === "string" ? req.query.store : "";
    const adminUser = typeof req.query.adm_user === "string" ? req.query.adm_user : "";
    const authorizationUrl = buildTrayAuthorizationUrl({
      storeHost,
      callbackUrl: `${env.APP_URL}/tray/callback/auth`
    });

    res.type("html").send(renderTrayPage({
      title: "Conectar painel de pedidos",
      text: `Loja ${escapeHtml(store || storeHost)} pronta para autorizar o acesso aos pedidos.`,
      buttonLabel: "Autorizar integração",
      buttonUrl: `${authorizationUrl}&state=${encodeURIComponent(Buffer.from(JSON.stringify({ storeHost, store, adminUser })).toString("base64url"))}`
    }));
  })
);

publicRouter.get(
  "/callback/auth",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        code: z.string().min(16),
        api_address: z.string().url(),
        store_host: z.string().url().optional(),
        adm_user: z.string().optional(),
        state: z.string().optional()
      })
      .parse(req.query);

    let state: { storeHost?: string; adminUser?: string } = {};
    if (input.state) {
      try {
        state = JSON.parse(Buffer.from(input.state, "base64url").toString("utf8")) as typeof state;
      } catch {
        state = {};
      }
    }

    const store = await exchangeAuthorizationCode({
      apiAddress: input.api_address,
      code: input.code,
      storeHost: input.store_host || state.storeHost,
      adminUser: input.adm_user || state.adminUser
    });

    void syncMonth(store, currentMonth()).catch((error) => {
      console.error("Falha na sincronização inicial:", error instanceof Error ? error.message : error);
    });

    res.type("html").send(renderTrayPage({
      title: "Integração concluída",
      text: "A loja foi autorizada. O painel já iniciou a sincronização dos pedidos do mês.",
      buttonLabel: "Abrir dashboard",
      buttonUrl: env.APP_URL
    }));
  })
);

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  };
  return value.replace(/[&<>'"]/g, (character) => entities[character] ?? character);
}

function renderTrayPage(input: { title: string; text: string; buttonLabel: string; buttonUrl: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.title)}</title><style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui;background:#070b14;color:#f7f9ff}*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 0,#14254d 0,transparent 38%),#070b14}
.card{width:min(560px,100%);padding:40px;border:1px solid #24304a;border-radius:24px;background:rgba(12,18,32,.92);box-shadow:0 30px 90px #0008}
.badge{display:inline-flex;padding:8px 12px;border-radius:999px;background:#0b2f2a;color:#52f0b1;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
h1{font-size:32px;margin:20px 0 10px}p{color:#aab5ca;line-height:1.7;margin:0 0 28px}.button{display:inline-flex;padding:14px 20px;border-radius:14px;background:#2867ff;color:white;text-decoration:none;font-weight:800;box-shadow:0 10px 35px #2867ff55}
</style></head><body><main class="card"><span class="badge">Tray conectada</span><h1>${escapeHtml(input.title)}</h1><p>${escapeHtml(input.text)}</p><a class="button" href="${escapeHtml(input.buttonUrl)}" target="_top">${escapeHtml(input.buttonLabel)}</a></main></body></html>`;
}

export { apiRouter, publicRouter };
