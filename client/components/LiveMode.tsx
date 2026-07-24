import { Clock3, Gauge, Minimize2, Radio, Target, Trophy } from "lucide-react";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { useClock } from "../hooks/useClock";
import type { DashboardData, NewOrderEvent } from "../types";
import { Brand } from "./Brand";
import { OrdersChart } from "./OrdersChart";

function formatRemainingTime(monthEndsAt: string, now: Date): string {
  const milliseconds = Math.max(0, new Date(monthEndsAt).getTime() - now.getTime());
  if (milliseconds <= 0) return "Encerrado";

  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}min`;
}

export function LiveMode(props: {
  data: DashboardData;
  lastOrder: NewOrderEvent | null;
  pulseKey: number;
  onClose: () => void;
}) {
  const count = useAnimatedNumber(props.data.summary.orders, 1000);
  const clock = useClock();
  const progress = Math.min(100, props.data.summary.progress);
  const circumference = 2 * Math.PI * 76;

  return (
    <section className={`live-mode ${props.pulseKey ? "live-mode--pulse" : ""}`} key={`live-${props.pulseKey}`}>
      <div className="live-grid" />
      <div className="live-glow live-glow--one" />
      <div className="live-glow live-glow--two" />

      <header className="live-header">
        <Brand />
        <div className="live-status">
          <span className="live-status__dot" />
          <Radio size={16} /> AO VIVO
        </div>
        <div className="live-clock">
          <strong>{clock.toLocaleTimeString("pt-BR")}</strong>
          <span>{clock.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
        </div>
        <button className="button button--secondary" onClick={props.onClose}>
          <Minimize2 size={18} /> Sair da tela cheia
        </button>
      </header>

      <main className="live-content">
        <div className="live-counter-wrap">
          <div className="live-ring">
            <svg viewBox="0 0 180 180" aria-hidden="true">
              <circle cx="90" cy="90" r="76" className="live-ring__track" />
              <circle
                cx="90"
                cy="90"
                r="76"
                className="live-ring__progress"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * progress) / 100}
              />
            </svg>
            <div className="live-ring__center">
              <span>PEDIDOS NO MÊS</span>
              <strong>{Math.round(count).toLocaleString("pt-BR")}</strong>
              <small>{props.data.summary.progress.toLocaleString("pt-BR")}% de {props.data.summary.goalLabel}</small>
            </div>
          </div>

          <div className="live-level-chip">
            <Trophy size={18} />
            <span>{props.data.goals.allCompleted ? "Todas as metas concluídas" : `Meta atual · ${props.data.summary.goalLabel}`}</span>
            <strong>{props.data.summary.goal.toLocaleString("pt-BR")}</strong>
          </div>

          <div className="live-targets">
            <div>
              <Target size={21} />
              <span>Meta atual</span>
              <strong>{props.data.summary.goal.toLocaleString("pt-BR")}</strong>
            </div>
            <div>
              <Gauge size={21} />
              <span>Faltam</span>
              <strong>{props.data.summary.remaining.toLocaleString("pt-BR")}</strong>
            </div>
            <div>
              <span>Ritmo necessário</span>
              <strong>{props.data.summary.requiredDaily.toLocaleString("pt-BR")}/dia</strong>
            </div>
            <div>
              <Clock3 size={21} />
              <span>Tempo restante</span>
              <strong className="live-targets__time">{formatRemainingTime(props.data.summary.monthEndsAt, clock)}</strong>
            </div>
          </div>
        </div>

        <div className="live-chart-panel">
          <div className="live-chart-panel__header">
            <div>
              <span className="eyebrow">RITMO DIÁRIO EM TEMPO REAL</span>
              <h2>Número de pedidos por dia</h2>
            </div>
            {props.lastOrder && (
              <div className="live-last-order">
                <span>Último pedido</span>
                <strong>#{props.lastOrder.trayOrderId}</strong>
                <small>{props.lastOrder.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</small>
              </div>
            )}
          </div>
          <OrdersChart data={props.data.chart} compact mode="daily" />
        </div>
      </main>

      {props.pulseKey > 0 && <div className="order-wave" />}
    </section>
  );
}
