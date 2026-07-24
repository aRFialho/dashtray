import type { TrayStore } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../db";
import { decryptSecret, encryptSecret } from "./crypto";
import { HttpError } from "../utils/http-error";
import { parseTrayDateTime } from "../utils/date";

export type TrayTokenResponse = {
  message: string;
  code: string | number;
  access_token: string;
  refresh_token: string;
  date_expiration_access_token: string;
  date_expiration_refresh_token: string;
  date_activated?: string;
  api_host: string;
  store_id: string | number;
};

type TrayErrorPayload = {
  code?: string | number;
  message?: string;
  name?: string;
  causes?: unknown;
};

const refreshLocks = new Map<string, Promise<TrayStore>>();
const requestQueues = new Map<string, Promise<void>>();
const nextRequestAt = new Map<string, number>();
const TRAY_REQUEST_INTERVAL_MS = 350;
const MAX_TRANSIENT_RETRIES = 3;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForRateSlot(storeId: string): Promise<void> {
  const previous = requestQueues.get(storeId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const wait = Math.max(0, (nextRequestAt.get(storeId) ?? 0) - Date.now());
    if (wait > 0) await sleep(wait);
    nextRequestAt.set(storeId, Date.now() + TRAY_REQUEST_INTERVAL_MS);
  });

  requestQueues.set(storeId, current);
  await current;
  if (requestQueues.get(storeId) === current) requestQueues.delete(storeId);
}

function retryAfterMilliseconds(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Math.max(1_000, date.getTime() - Date.now());
  }
  return Math.min(15_000, 750 * 2 ** attempt);
}

function assertAllowedTrayHostname(url: URL): void {
  const hostname = url.hostname.toLowerCase();
  const allowed = env.allowedTrayHostnames.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }
    return hostname === pattern;
  });

  if (env.allowedTrayHostnames.length && !allowed) {
    throw new HttpError(400, `Host Tray não autorizado para este aplicativo: ${url.hostname}`);
  }
}

function normalizeApiAddress(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new HttpError(400, "O api_address da Tray precisa usar HTTPS.");
  assertAllowedTrayHostname(url);
  if (!url.pathname.replace(/\/$/, "").endsWith("/web_api")) {
    throw new HttpError(400, "O api_address precisa terminar em /web_api.");
  }
  return url.toString().replace(/\/$/, "");
}

function parseTrayTokenDate(value: string): Date {
  const parsed = parseTrayDateTime(value, env.APP_TIMEZONE);
  if (!parsed) throw new Error(`Data de token inválida recebida da Tray: ${value}`);
  return parsed;
}

function isUnauthorizedPayload(payload: TrayErrorPayload | null): boolean {
  if (!payload) return false;
  const code = Number(payload.code);
  const message = `${payload.message ?? ""} ${payload.name ?? ""}`.trim().toLowerCase();
  return (
    code === 401 ||
    code === 403 ||
    message.includes("unauthorized access") ||
    message.includes("invalid or expired token") ||
    message.includes("token expirado") ||
    message.includes("token inválido")
  );
}

async function isUnauthorizedResponse(response: Response): Promise<boolean> {
  if (response.status === 401 || response.status === 403) return true;

  try {
    const text = await response.clone().text();
    if (!text) return false;
    return isUnauthorizedPayload(JSON.parse(text) as TrayErrorPayload);
  } catch {
    return false;
  }
}

function isUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) return true;
  const message = error.message.toLowerCase();
  return message.includes("unauthorized access") || message.includes("invalid or expired token");
}

async function parseTrayResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: T | TrayErrorPayload | null = null;

  try {
    payload = text ? (JSON.parse(text) as T | TrayErrorPayload) : null;
  } catch {
    throw new HttpError(response.status || 502, "A Tray retornou uma resposta que não é JSON.");
  }

  const error = payload as TrayErrorPayload | null;
  if (isUnauthorizedPayload(error)) {
    throw new HttpError(401, error?.message || error?.name || "Token Tray inválido ou expirado.", error);
  }

  if (!response.ok) {
    throw new HttpError(response.status, error?.message || error?.name || "Erro ao consultar a Tray.", error);
  }

  return payload as T;
}

export async function exchangeAuthorizationCode(input: {
  apiAddress: string;
  code: string;
  storeHost?: string;
  adminUser?: string;
}): Promise<TrayStore> {
  if (!env.TRAY_CONSUMER_KEY || !env.TRAY_CONSUMER_SECRET) {
    throw new HttpError(500, "TRAY_CONSUMER_KEY e TRAY_CONSUMER_SECRET não foram configurados.");
  }

  const apiAddress = normalizeApiAddress(input.apiAddress);
  const body = new URLSearchParams({
    consumer_key: env.TRAY_CONSUMER_KEY,
    consumer_secret: env.TRAY_CONSUMER_SECRET,
    code: input.code
  });

  const response = await fetch(`${apiAddress}/auth`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000)
  });

  const tokenData = await parseTrayResponse<TrayTokenResponse>(response);
  const storeId = String(tokenData.store_id);

  return prisma.trayStore.upsert({
    where: { storeId },
    create: {
      storeId,
      apiAddress: normalizeApiAddress(tokenData.api_host || apiAddress),
      storeHost: input.storeHost,
      adminUser: input.adminUser,
      accessTokenEnc: encryptSecret(tokenData.access_token),
      refreshTokenEnc: encryptSecret(tokenData.refresh_token),
      accessTokenExpiresAt: parseTrayTokenDate(tokenData.date_expiration_access_token),
      refreshTokenExpiresAt: parseTrayTokenDate(tokenData.date_expiration_refresh_token),
      active: true
    },
    update: {
      apiAddress: normalizeApiAddress(tokenData.api_host || apiAddress),
      storeHost: input.storeHost,
      adminUser: input.adminUser,
      accessTokenEnc: encryptSecret(tokenData.access_token),
      refreshTokenEnc: encryptSecret(tokenData.refresh_token),
      accessTokenExpiresAt: parseTrayTokenDate(tokenData.date_expiration_access_token),
      refreshTokenExpiresAt: parseTrayTokenDate(tokenData.date_expiration_refresh_token),
      active: true
    }
  });
}

async function refreshStoreToken(store: TrayStore): Promise<TrayStore> {
  const existing = refreshLocks.get(store.id);
  if (existing) return existing;

  const task = (async () => {
    const refreshToken = decryptSecret(store.refreshTokenEnc);
    const url = new URL(`${normalizeApiAddress(store.apiAddress)}/auth`);
    url.searchParams.set("refresh_token", refreshToken);

    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(20_000)
    });
    const tokenData = await parseTrayResponse<TrayTokenResponse>(response);

    return prisma.trayStore.update({
      where: { id: store.id },
      data: {
        apiAddress: normalizeApiAddress(tokenData.api_host || store.apiAddress),
        accessTokenEnc: encryptSecret(tokenData.access_token),
        refreshTokenEnc: encryptSecret(tokenData.refresh_token),
        accessTokenExpiresAt: parseTrayTokenDate(tokenData.date_expiration_access_token),
        refreshTokenExpiresAt: parseTrayTokenDate(tokenData.date_expiration_refresh_token),
        active: true
      }
    });
  })();

  refreshLocks.set(store.id, task);
  try {
    return await task;
  } finally {
    refreshLocks.delete(store.id);
  }
}

export async function getValidStore(store: TrayStore, forceRefresh = false): Promise<TrayStore> {
  const refreshThreshold = Date.now() + 5 * 60 * 1000;
  if (!forceRefresh && store.accessTokenExpiresAt.getTime() > refreshThreshold) return store;

  if (store.refreshTokenExpiresAt.getTime() <= Date.now()) {
    await prisma.trayStore.update({ where: { id: store.id }, data: { active: false } });
    throw new HttpError(401, "O refresh_token da Tray expirou. Reautorize o aplicativo.");
  }

  try {
    return await refreshStoreToken(store);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      await prisma.trayStore.update({ where: { id: store.id }, data: { active: false } });
      throw new HttpError(
        401,
        "A autorização da Tray expirou ou foi revogada. Conecte novamente a loja na aba Integração Tray."
      );
    }
    throw error;
  }
}

export async function trayRequest<T>(
  originalStore: TrayStore,
  path: string,
  params: Record<string, string | number | undefined> = {},
  attempt = 0,
  tokenRetry = true
): Promise<T> {
  const store = await getValidStore(originalStore);
  const token = decryptSecret(store.accessTokenEnc);
  const url = new URL(`${normalizeApiAddress(store.apiAddress)}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", token);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });

  await waitForRateSlot(store.id);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(25_000)
  });

  if (tokenRetry && await isUnauthorizedResponse(response)) {
    await response.body?.cancel();
    const refreshed = await getValidStore(store, true);
    return trayRequest<T>(refreshed, path, params, attempt, false);
  }

  if ((response.status === 429 || response.status >= 500) && attempt < MAX_TRANSIENT_RETRIES) {
    const delay = retryAfterMilliseconds(response, attempt);
    await response.body?.cancel();
    await sleep(delay);
    return trayRequest<T>(store, path, params, attempt + 1, tokenRetry);
  }

  return parseTrayResponse<T>(response);
}

export function buildTrayAuthorizationUrl(input: { storeHost: string; callbackUrl: string }): string {
  if (!env.TRAY_CONSUMER_KEY) throw new HttpError(500, "TRAY_CONSUMER_KEY não configurada.");

  const storeHost = new URL(input.storeHost);
  if (storeHost.protocol !== "https:") throw new HttpError(400, "A loja Tray precisa usar HTTPS.");
  assertAllowedTrayHostname(storeHost);

  const url = new URL("/auth.php", storeHost.origin);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("consumer_key", env.TRAY_CONSUMER_KEY);
  url.searchParams.set("callback", input.callbackUrl);
  return url.toString();
}
