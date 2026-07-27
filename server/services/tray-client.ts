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
const ACCESS_REFRESH_LEEWAY_MS = 10 * 60 * 1000;
const REFRESH_RECOVERY_DELAYS_MS = [200, 600, 1_500, 3_000];

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
    code === 1000 ||
    message.includes("unauthorized access") ||
    message.includes("invalid or expired token") ||
    message.includes("invalid token") ||
    message.includes("expired token") ||
    message.includes("token expirado") ||
    message.includes("token inválido") ||
    message.includes("token invalido")
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
  return (
    message.includes("unauthorized access") ||
    message.includes("invalid or expired token") ||
    message.includes("invalid token") ||
    message.includes("expired token") ||
    message.includes("token expirado") ||
    message.includes("token inválido") ||
    message.includes("token invalido") ||
    (message.includes("refresh") && (message.includes("invalid") || message.includes("expired")))
  );
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

function assertTokenResponse(payload: TrayTokenResponse): TrayTokenResponse {
  const required: Array<keyof TrayTokenResponse> = [
    "access_token",
    "refresh_token",
    "date_expiration_access_token",
    "date_expiration_refresh_token",
    "api_host",
    "store_id"
  ];

  for (const field of required) {
    const value = payload?.[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new HttpError(502, `A Tray não retornou o campo obrigatório ${field} ao gerar/renovar os tokens.`);
    }
  }

  return payload;
}

async function loadStore(storeId: string): Promise<TrayStore> {
  const store = await prisma.trayStore.findUnique({ where: { id: storeId } });
  if (!store) throw new HttpError(404, "A loja conectada não foi encontrada no banco de dados.");
  return store;
}

function tokenMaterialChanged(reference: TrayStore, current: TrayStore): boolean {
  return (
    reference.accessTokenEnc !== current.accessTokenEnc ||
    reference.refreshTokenEnc !== current.refreshTokenEnc ||
    reference.accessTokenExpiresAt.getTime() !== current.accessTokenExpiresAt.getTime() ||
    reference.refreshTokenExpiresAt.getTime() !== current.refreshTokenExpiresAt.getTime()
  );
}

function accessTokenIsUsable(store: TrayStore, leewayMs = ACCESS_REFRESH_LEEWAY_MS): boolean {
  return store.accessTokenExpiresAt.getTime() > Date.now() + leewayMs;
}

async function recoverRefreshCompletedElsewhere(
  reference: TrayStore,
  includeInitialRead = true
): Promise<TrayStore | null> {
  const delays = includeInitialRead ? [0, ...REFRESH_RECOVERY_DELAYS_MS] : REFRESH_RECOVERY_DELAYS_MS;

  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    const current = await loadStore(reference.id);
    if (tokenMaterialChanged(reference, current) && current.accessTokenExpiresAt.getTime() > Date.now() + 30_000) {
      console.info(`[tray:token] renovação concorrente recuperada para a loja ${current.storeId}.`);
      return current;
    }
  }

  return null;
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

  const tokenData = assertTokenResponse(await parseTrayResponse<TrayTokenResponse>(response));
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

async function refreshStoreToken(inputStore: TrayStore, forceRefresh: boolean): Promise<TrayStore> {
  const existing = refreshLocks.get(inputStore.id);
  if (existing) return existing;

  const task = (async () => {
    const current = await loadStore(inputStore.id);

    // Outro request ou outra instância já pode ter renovado enquanto este request aguardava.
    if (tokenMaterialChanged(inputStore, current) && current.accessTokenExpiresAt.getTime() > Date.now() + 30_000) {
      return current;
    }

    if (!forceRefresh && accessTokenIsUsable(current)) return current;

    if (current.refreshTokenExpiresAt.getTime() <= Date.now()) {
      throw new HttpError(401, "O refresh_token da Tray expirou. Reautorize o aplicativo.");
    }

    const attemptedStore = current;
    const refreshToken = decryptSecret(attemptedStore.refreshTokenEnc);
    const url = new URL(`${normalizeApiAddress(attemptedStore.apiAddress)}/auth`);
    url.searchParams.set("refresh_token", refreshToken);

    let tokenData: TrayTokenResponse;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000)
      });
      tokenData = assertTokenResponse(await parseTrayResponse<TrayTokenResponse>(response));
    } catch (error) {
      // Em múltiplas instâncias, uma delas pode ter consumido/rotacionado o refresh_token.
      // Antes de declarar a loja desconectada, verificamos se o Neon já recebeu tokens novos.
      if (isUnauthorizedError(error)) {
        const recovered = await recoverRefreshCompletedElsewhere(attemptedStore);
        if (recovered) return recovered;
      }
      throw error;
    }

    const nextData = {
      apiAddress: normalizeApiAddress(tokenData.api_host || attemptedStore.apiAddress),
      accessTokenEnc: encryptSecret(tokenData.access_token),
      refreshTokenEnc: encryptSecret(tokenData.refresh_token),
      accessTokenExpiresAt: parseTrayTokenDate(tokenData.date_expiration_access_token),
      refreshTokenExpiresAt: parseTrayTokenDate(tokenData.date_expiration_refresh_token),
      active: true
    };

    // Atualização otimista: somente quem ainda possui o refresh_token usado pode gravar.
    // Evita que uma resposta concorrente sobrescreva tokens mais recentes no Neon.
    const updated = await prisma.trayStore.updateMany({
      where: { id: attemptedStore.id, refreshTokenEnc: attemptedStore.refreshTokenEnc },
      data: nextData
    });

    if (updated.count === 0) {
      const recovered = await recoverRefreshCompletedElsewhere(attemptedStore);
      if (recovered) return recovered;
      throw new HttpError(409, "Os tokens da Tray foram alterados durante a renovação. Tente novamente.");
    }

    const saved = await loadStore(attemptedStore.id);
    console.info(
      `[tray:token] renovado automaticamente para a loja ${saved.storeId}; access até ${saved.accessTokenExpiresAt.toISOString()}; refresh até ${saved.refreshTokenExpiresAt.toISOString()}.`
    );
    return saved;
  })();

  refreshLocks.set(inputStore.id, task);
  try {
    return await task;
  } finally {
    if (refreshLocks.get(inputStore.id) === task) refreshLocks.delete(inputStore.id);
  }
}

export async function getValidStore(inputStore: TrayStore, forceRefresh = false): Promise<TrayStore> {
  const current = await loadStore(inputStore.id);

  // Nunca confie no objeto recebido pela sincronização: ele pode ter sido carregado antes
  // de outra página, webhook ou instância renovar os tokens.
  if (tokenMaterialChanged(inputStore, current) && current.accessTokenExpiresAt.getTime() > Date.now() + 30_000) {
    return current;
  }

  if (!forceRefresh && accessTokenIsUsable(current)) return current;

  if (current.refreshTokenExpiresAt.getTime() <= Date.now()) {
    await prisma.trayStore.updateMany({
      where: { id: current.id, refreshTokenEnc: current.refreshTokenEnc },
      data: { active: false }
    });
    throw new HttpError(401, "O refresh_token da Tray expirou. Reautorize o aplicativo.");
  }

  try {
    return await refreshStoreToken(current, forceRefresh);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      const recovered = await recoverRefreshCompletedElsewhere(current, false);
      if (recovered) return recovered;

      // Só desativa se ninguém substituiu o token que efetivamente falhou.
      await prisma.trayStore.updateMany({
        where: { id: current.id, refreshTokenEnc: current.refreshTokenEnc },
        data: { active: false }
      });
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

export async function recoverInactiveTrayStores(): Promise<number> {
  const candidates = await prisma.trayStore.findMany({
    where: {
      active: false,
      refreshTokenExpiresAt: { gt: new Date() }
    },
    orderBy: { updatedAt: "desc" },
    take: 10
  });

  let recoveredCount = 0;
  for (const candidate of candidates) {
    try {
      const recovered = await refreshStoreToken(candidate, true);
      if (recovered.active) {
        recoveredCount += 1;
        console.info(`[tray:token] autorização reativada automaticamente para a loja ${recovered.storeId}.`);
      }
    } catch (error) {
      console.warn(
        `[tray:token] não foi possível reativar a loja ${candidate.storeId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return recoveredCount;
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
