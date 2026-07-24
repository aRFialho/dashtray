async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers
    },
    ...options
  });

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || `Erro HTTP ${response.status}`);
  return payload as T;
}

export const api = {
  me: () => request<{ user: { email: string } }>("/api/auth/me"),
  login: (email: string, password: string) =>
    request<{ user: { email: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  dashboard: (month: string) => request<import("./types").DashboardData>(`/api/dashboard?month=${month}`),
  saveGoals: (month: string, levels: import("./types").GoalLevelInput[]) =>
    request<{ dashboard: import("./types").DashboardData }>(`/api/goals/${month}`, {
      method: "PUT",
      body: JSON.stringify({ levels })
    }),
  sync: (month: string) =>
    request<{ dashboard: import("./types").DashboardData }>("/api/sync", {
      method: "POST",
      body: JSON.stringify({ month })
    }),
  trayStatus: () => request<import("./types").TrayStatus>("/api/tray/status"),
  connectTray: (input: { apiAddress: string; code: string; storeHost?: string }) =>
    request<{ dashboard: import("./types").DashboardData }>("/api/tray/connect", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  authorizationUrl: (storeHost: string) =>
    request<{ url: string }>("/api/tray/authorization-url", {
      method: "POST",
      body: JSON.stringify({ storeHost })
    }),
  webhooks: (status: string = "all") =>
    request<import("./types").WebhookManagement>(`/api/tray/webhooks?status=${encodeURIComponent(status)}`),
  testWebhookPipeline: () =>
    request<{ message: string; management: import("./types").WebhookManagement }>("/api/tray/webhooks/test", {
      method: "POST"
    }),
  retryFailedWebhooks: () =>
    request<{ queued: number; management: import("./types").WebhookManagement }>("/api/tray/webhooks/retry-failed", {
      method: "POST"
    }),
  reprocessWebhook: (id: string) =>
    request<{ queued: boolean; management: import("./types").WebhookManagement }>(`/api/tray/webhooks/${encodeURIComponent(id)}/reprocess`, {
      method: "POST"
    })
};
