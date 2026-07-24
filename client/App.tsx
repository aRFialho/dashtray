import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, Gauge, Percent, ShoppingBag, Target } from "lucide-react";
import { io } from "socket.io-client";
import { api } from "./api";
import { CelebrationOverlay } from "./components/CelebrationOverlay";
import { GoalPanel } from "./components/GoalPanel";
import { GoalSettings } from "./components/GoalSettings";
import { Header } from "./components/Header";
import { LiveMode } from "./components/LiveMode";
import { LoginPage } from "./components/LoginPage";
import { MetricCard } from "./components/MetricCard";
import { OrdersChart } from "./components/OrdersChart";
import { RecentOrders } from "./components/RecentOrders";
import { Sidebar, type ViewName } from "./components/Sidebar";
import { TrayIntegration } from "./components/TrayIntegration";
import { useClock } from "./hooks/useClock";
import type { DashboardData, GoalAchievementEvent, GoalLevelInput, LiveIncrementEvent, NewOrderEvent } from "./types";


function formatRemainingTime(monthEndsAt: string, now: Date): string {
  const milliseconds = Math.max(0, new Date(monthEndsAt).getTime() - now.getTime());
  if (milliseconds <= 0) return "Encerrado";

  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}min`;
}

function formatDashboardPeriod(start: string, end: string): string {
  const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" };
  const startLabel = new Date(start).toLocaleDateString("pt-BR", options);
  const inclusiveEnd = new Date(new Date(end).getTime() - 1);
  const endLabel = inclusiveEnd.toLocaleDateString("pt-BR", options);
  return `${startLabel} até ${endLabel}`;
}

function browserMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export default function App() {
  const [auth, setAuth] = useState<{ loading: boolean; email: string | null }>({ loading: true, email: null });
  const [month, setMonth] = useState(browserMonth());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [view, setView] = useState<ViewName>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [lastOrder, setLastOrder] = useState<NewOrderEvent | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [celebrations, setCelebrations] = useState<GoalAchievementEvent[]>([]);
  const [liveIncrement, setLiveIncrement] = useState<LiveIncrementEvent | null>(null);
  const dashboardRef = useRef<DashboardData | null>(null);
  const liveModeRef = useRef(false);
  const incrementTimerRef = useRef<number | null>(null);
  const clock = useClock(60_000);

  useEffect(() => {
    liveModeRef.current = liveMode;
  }, [liveMode]);

  const applyDashboard = useCallback((data: DashboardData, animateIncrement = true) => {
    const previous = dashboardRef.current;
    const delta = previous?.month === data.month
      ? data.summary.orders - previous.summary.orders
      : 0;

    if (animateIncrement && liveModeRef.current && delta > 0) {
      const currentPoint = [...data.chart].reverse().find((point) => point.dailyOrders !== null);
      const now = Date.now();

      setLiveIncrement((current) => ({
        id: now,
        amount: current && now - current.createdAt < 900 ? current.amount + delta : delta,
        day: currentPoint?.day ?? new Date().getDate(),
        createdAt: now
      }));
      setPulseKey((key) => key + 1);

      if (incrementTimerRef.current !== null) window.clearTimeout(incrementTimerRef.current);
      incrementTimerRef.current = window.setTimeout(() => {
        setLiveIncrement(null);
        incrementTimerRef.current = null;
      }, 2_600);
    }

    dashboardRef.current = data;
    setDashboard(data);
  }, []);

  useEffect(() => () => {
    if (incrementTimerRef.current !== null) window.clearTimeout(incrementTimerRef.current);
  }, []);

  const loadDashboard = useCallback(async (selectedMonth = month) => {
    const data = await api.dashboard(selectedMonth);
    applyDashboard(data);
  }, [applyDashboard, month]);

  useEffect(() => {
    api.me()
      .then(({ user }) => setAuth({ loading: false, email: user.email }))
      .catch(() => setAuth({ loading: false, email: null }));
  }, []);

  useEffect(() => {
    if (!auth.email) return;
    loadDashboard().catch((error) => setNotice(error instanceof Error ? error.message : "Falha ao carregar painel."));
  }, [auth.email, loadDashboard]);

  useEffect(() => {
    if (!auth.email) return;
    const socket = io({ transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      loadDashboard(month).catch(() => undefined);
    });
    socket.on("dashboard:update", (data: DashboardData) => {
      if (data.month === month) applyDashboard(data);
    });
    socket.on("order:new", (order: NewOrderEvent) => {
      setLastOrder(order);
      setNotice(`Novo pedido #${order.trayOrderId} recebido.`);
    });
    socket.on("goal:achieved", (achievement: GoalAchievementEvent) => {
      setCelebrations((current) => current.some((item) => item.id === achievement.id)
        ? current
        : [...current, achievement]);
      setNotice(`Meta atingida: ${achievement.label}!`);
    });
    return () => {
      socket.disconnect();
    };
  }, [applyDashboard, auth.email, loadDashboard, month]);

  useEffect(() => {
    if (!auth.email) return;
    const refresh = () => loadDashboard(month).catch(() => undefined);
    const interval = window.setInterval(refresh, 180_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [auth.email, loadDashboard, month]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        liveModeRef.current = false;
        setLiveMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  const monthLabel = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  }, [month]);

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    setAuth({ loading: false, email: result.user.email });
  }

  async function logout() {
    await api.logout();
    setAuth({ loading: false, email: null });
    dashboardRef.current = null;
    setDashboard(null);
  }

  async function sync() {
    setSyncing(true);
    setNotice("");
    try {
      const result = await api.sync(month);
      applyDashboard(result.dashboard);
      setNotice("Sincronização concluída.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha na sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  async function saveGoals(levels: GoalLevelInput[]) {
    const result = await api.saveGoals(month, levels);
    applyDashboard(result.dashboard);
  }

  async function openLiveMode() {
    liveModeRef.current = true;
    setLiveMode(true);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // O navegador pode bloquear fullscreen; o layout ao vivo continua aberto.
    }
  }

  async function closeLiveMode() {
    liveModeRef.current = false;
    setLiveMode(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  }

  const dismissCelebration = useCallback(() => {
    setCelebrations((current) => current.slice(1));
  }, []);

  if (auth.loading) {
    return <div className="boot-screen"><div className="boot-screen__orb" /><span>Inicializando painel...</span></div>;
  }

  if (!auth.email) return <LoginPage onLogin={login} />;

  if (liveMode && dashboard) {
    return (
      <>
        <LiveMode
          data={dashboard}
          lastOrder={lastOrder}
          pulseKey={pulseKey}
          increment={liveIncrement}
          refreshing={syncing}
          notice={notice}
          onRefresh={() => void sync()}
          onClose={() => void closeLiveMode()}
        />
        {celebrations[0] && <CelebrationOverlay event={celebrations[0]} onClose={dismissCelebration} />}
      </>
    );
  }

  return (
    <>
    <div className={`app-shell ${collapsed ? "app-shell--collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        view={view}
        onToggle={() => setCollapsed((value) => !value)}
        onChangeView={setView}
        onLogout={() => void logout()}
      />

      <div className="app-main">
        <Header
          month={month}
          onMonthChange={(value) => value && setMonth(value)}
          onSync={() => void sync()}
          syncing={syncing}
          onLiveMode={() => void openLiveMode()}
          onToggleSidebar={() => setCollapsed((value) => !value)}
          email={auth.email}
        />

        <main className="page-content">
          {notice && <div className="toast">{notice}</div>}

          {view === "dashboard" && (
            dashboard ? (
              dashboard.connected ? (
                <>
                  <section className="page-intro">
                    <div>
                      <span className="eyebrow">VISÃO MENSAL</span>
                      <h2>{monthLabel}</h2>
                      <p>Período {formatDashboardPeriod(dashboard.period.start, dashboard.period.end)}, status monitorados <strong>{dashboard.trackedStatus}</strong>.</p>
                    </div>
                    <div className="sync-pill">
                      <span className="system-status__dot" />
                      {dashboard.store?.lastSyncAt
                        ? `Atualizado ${new Date(dashboard.store.lastSyncAt).toLocaleString("pt-BR")}`
                        : "Aguardando primeira sincronização"}
                    </div>
                  </section>

                  <section className="metrics-grid">
                    <MetricCard label="Pedidos no mês" value={dashboard.summary.orders} description={`Status: ${dashboard.trackedStatus}`} icon={ShoppingBag} tone="blue" />
                    <MetricCard label="Meta atual" value={dashboard.summary.goal} description={dashboard.summary.goalLabel} icon={Target} tone="purple" />
                    <MetricCard label="Faltam para a meta" value={dashboard.summary.remaining} description="Pedidos necessários para concluir" icon={Gauge} tone="red" />
                    <MetricCard label="Meta atingida" value={dashboard.summary.progress} suffix="%" decimals={1} description="Percentual alcançado no mês" icon={Percent} tone="green" />
                    <MetricCard label="Ritmo necessário" value={dashboard.summary.requiredDaily} suffix="/dia" description={`${dashboard.summary.remainingDaysIncludingToday} dias contando hoje`} icon={CalendarDays} tone="amber" />
                    <MetricCard label="Tempo restante" value={formatRemainingTime(dashboard.summary.monthEndsAt, clock)} description={`${dashboard.summary.daysRemaining} dias completos após hoje`} icon={Clock3} tone="cyan" />
                  </section>

                  <section className="dashboard-grid">
                    <article className="panel chart-panel">
                      <div className="panel__header">
                        <div>
                          <span className="eyebrow">CURVA DE DESEMPENHO</span>
                          <h2>Pedidos acumulados x meta</h2>
                        </div>
                        <div className="chart-legend"><span className="chart-legend__orders" />Pedidos <span className="chart-legend__target" />Ritmo ideal</div>
                      </div>
                      <OrdersChart data={dashboard.chart} />
                    </article>
                    <GoalPanel data={dashboard} onEdit={() => setView("goals")} />
                  </section>

                  <RecentOrders orders={dashboard.recentOrders} />
                </>
              ) : (
                <section className="connect-empty panel">
                  <div className="connect-empty__icon">T</div>
                  <span className="eyebrow">PRIMEIRO PASSO</span>
                  <h2>Conecte a loja Tray</h2>
                  <p>Cadastre as credenciais do aplicativo no Render e conclua a autorização da loja para liberar o contador.</p>
                  <button className="button button--primary" onClick={() => setView("integration")}>Abrir integração</button>
                </section>
              )
            ) : <div className="loading-panel">Carregando indicadores...</div>
          )}

          {view === "goals" && dashboard && (
            <GoalSettings data={dashboard} month={month} onSave={saveGoals} />
          )}

          {view === "integration" && (
            <TrayIntegration onConnected={() => loadDashboard(month)} />
          )}
        </main>
      </div>
    </div>
    {celebrations[0] && <CelebrationOverlay event={celebrations[0]} onClose={dismissCelebration} />}
    </>
  );
}
