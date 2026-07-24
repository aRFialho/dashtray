export type DashboardData = {
  connected: boolean;
  month: string;
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
    progress: number;
    remaining: number;
    dailyAverage: number;
    projectedOrders: number;
  };
  chart: Array<{
    day: number;
    orders: number;
    dailyOrders: number;
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
