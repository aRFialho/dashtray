export type GoalLevel = {
  id: string;
  position: number;
  label: string;
  targetOrders: number;
  achieved: boolean;
  achievedAt: string | null;
};

export type GoalLevelInput = {
  label: string;
  targetOrders: number;
};

export type DashboardData = {
  connected: boolean;
  month: string;
  trackedStatus: string;
  period: {
    start: string;
    end: string;
  };
  store: null | {
    id: string;
    storeId: string;
    storeHost: string | null;
    apiAddress: string;
    lastSyncAt: string | null;
    tokenExpiresAt: string;
  };
  summary: {
    orders: number;
    goal: number;
    goalLabel: string;
    progress: number;
    remaining: number;
    dailyAverage: number;
    projectedOrders: number;
    requiredDaily: number;
    daysRemaining: number;
    remainingDaysIncludingToday: number;
    monthEndsAt: string;
  };
  goals: {
    levels: GoalLevel[];
    activeLevel: GoalLevel | null;
    nextLevel: GoalLevel | null;
    completedCount: number;
    totalCount: number;
    allCompleted: boolean;
    stageProgress: number;
  };
  chart: Array<{
    day: number;
    orders: number | null;
    dailyOrders: number | null;
    target: number;
  }>;
  recentOrders: Array<{
    trayOrderId: string;
    orderDate: string;
    modifiedAt: string | null;
    status: string;
    total: number;
    pointSale: string | null;
    externalCode: string | null;
  }>;
  sync: null | {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    items: number;
    message: string | null;
  };
};

export type TrayStatus = {
  connected: boolean;
  store: null | {
    storeId: string;
    storeHost: string | null;
    apiAddress: string;
    active: boolean;
    installedAt: string;
    lastSyncAt: string | null;
    tokenExpiresAt: string;
  };
  callbackUrl: string;
  authCallbackUrl: string;
  webhookUrl: string;
};

export type NewOrderEvent = {
  trayOrderId: string;
  total: number;
  status: string;
  occurredAt: string;
};

export type LiveIncrementEvent = {
  id: number;
  amount: number;
  day: number;
  createdAt: number;
};

export type GoalAchievementEvent = {
  id: string;
  month: string;
  levelId: string;
  position: number;
  label: string;
  targetOrders: number;
  orderCount: number;
  achievedAt: string;
  nextLevel: null | {
    position: number;
    label: string;
    targetOrders: number;
  };
};

export type WebhookEventStatus = "pending" | "processing" | "processed" | "retry" | "error" | "ignored";

export type WebhookEventItem = {
  id: string;
  sellerId: string;
  scopeName: string;
  scopeId: string;
  action: string;
  status: WebhookEventStatus;
  attempts: number;
  error: string | null;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  receivedAt: string;
  processedAt: string | null;
};

export type WebhookManagement = {
  connected: boolean;
  endpointUrl: string;
  tokenProtected: boolean;
  activationObserved: boolean;
  state: "disconnected" | "waiting" | "receiving" | "attention";
  stats: {
    total: number;
    last24h: number;
    pending: number;
    processing: number;
    processed: number;
    retry: number;
    error: number;
    ignored: number;
  };
  lastReceivedAt: string | null;
  events: WebhookEventItem[];
};

