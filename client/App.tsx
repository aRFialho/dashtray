import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ShoppingBag, Target, TrendingUp } from "lucide-react";
import { io } from "socket.io-client";
import { api } from "./api";
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
import type { DashboardData, NewOrderEvent } from "./types";

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

  const loadDashboard = useCallback(async (selectedMonth = month) => {
    const data = await api.dashboard(selectedMonth);
    setDashboard(data);
  }, [month]);

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
      if (data.month === month) setDashboard(data);
    });
    socket.on("order:new", (order: NewOrderEvent) => {
      setLastOrder(order);
      setPulseKey((key) => key + 1);
      setNotice(`Novo pedido #${order.trayOrderId} recebido.`);
    });
    return () => {
      socket.disconnect();
    };
  }, [auth.email, loadDashboard, month]);

  useEffect(() => {
    if (!auth.email) return;
    const refresh = () => loadDashboard(month).catch(() => undefined);
    const interval = window.setInterval(refresh, 60_000);
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
      if (!document.fullscreenElement) setLiveMode(false);
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
    setDashboard(null);
  }

  async function sync() {
    setSyncing(true);
    setNotice("");
    try {
      const result = await api.sync(month);
      setDashboard(result.dashboard);
      setNotice("Sincronização concluída.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha na sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  async function saveGoal(target: number) {
    const result = await api.saveGoal(month, target);
    setDashboard(result.dashboard);
  }

  async function openLiveMode() {
    setLiveMode(true);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // O navegador pode bloquear fullscreen; o layout ao vivo continua aberto.
    }
  }

  async function closeLiveMode() {
    setLiveMode(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  }

  if (auth.loading) {
    return <div className="boot-screen"><div className="boot-screen__orb" /><span>Inicializando painel...</span></div>;
  }

  if (!auth.email) return <LoginPage onLogin={login} />;

  if (liveMode && dashboard) {
    return <LiveMode data={dashboard} lastOrder={lastOrder} pulseKey={pulseKey} onClose={() => void closeLiveMode()} />;
  }

  return (
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
                      <p>Contagem sincronizada com a Tray, progresso da meta e projeção do fechamento.</p>
                    </div>
                    <div className="sync-pill">
                      <span className="system-status__dot" />
                      {dashboard.store?.lastSyncAt
                        ? `Atualizado ${new Date(dashboard.store.lastSyncAt).toLocaleString("pt-BR")}`
                        : "Aguardando primeira sincronização"}
                    </div>
                  </section>

                  <section className="metrics-grid">
                    <MetricCard label="Pedidos no mês" value={dashboard.summary.orders} description="Pedidos recebidos no período" icon={ShoppingBag} tone="blue" />
                    <MetricCard label="Meta do mês" value={dashboard.summary.goal} description="Definida pelo administrador" icon={Target} tone="purple" />
                    <MetricCard label="Progresso da meta" value={dashboard.summary.progress} suffix="%" decimals={1} description={`${dashboard.summary.remaining.toLocaleString("pt-BR")} pedidos restantes`} icon={TrendingUp} tone="green" />
                    <MetricCard label="Média diária" value={dashboard.summary.dailyAverage} decimals={1} description="Pedidos por dia corrido" icon={CalendarDays} tone="amber" />
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
            <GoalSettings data={dashboard} month={month} onSave={saveGoal} />
          )}

          {view === "integration" && (
            <TrayIntegration onConnected={() => loadDashboard(month)} />
          )}
        </main>
      </div>
    </div>
  );
}
