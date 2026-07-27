import {
  Clock3,
  Gauge,
  Minimize2,
  Percent,
  Radio,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy
} from "lucide-react";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { useClock } from "../hooks/useClock";
import type { DashboardData, LiveIncrementEvent, NewOrderEvent } from "../types";
import { Brand } from "./Brand";
import { LiveCoachMascot } from "./LiveCoachMascot";
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

function liveEncouragement(data: DashboardData): { tone: "success" | "positive" | "warning" | "boost"; title: string; text: string } {
  const { summary, goals } = data;

  if (summary.dailyGoalAchieved && summary.dailyGoal > 0) {
    return {
      tone: "success",
      title: "Meta diária atingida!",
      text: `A equipe já fez ${summary.todayOrders.toLocaleString("pt-BR")} pedidos hoje e cumpriu o ritmo necessário para ${summary.goalLabel}.`
    };
  }

  if (goals.allCompleted) {
    return {
      tone: "success",
      title: "Escada de metas concluída!",
      text: `Já são ${summary.orders.toLocaleString("pt-BR")} pedidos. Agora cada novo pedido amplia o recorde do mês.`
    };
  }

  if (summary.goal <= 0) {
    return {
      tone: "warning",
      title: "Defina a próxima meta",
      text: "Cadastre um nível de meta para liberar a projeção e o ritmo necessário do mês."
    };
  }

  const projectedRatio = summary.projectedOrders / summary.goal;
  const projectionDifference = summary.projectedOrders - summary.goal;

  if (summary.remaining === 0) {
    return {
      tone: "success",
      title: `${summary.goalLabel} conquistada!`,
      text: goals.nextLevel
        ? `Próximo alvo: ${goals.nextLevel.label}, com ${goals.nextLevel.targetOrders.toLocaleString("pt-BR")} pedidos.`
        : "O último nível foi alcançado. Hora de construir um novo recorde."
    };
  }

  if (summary.progress >= 90) {
    return {
      tone: "positive",
      title: "Reta final, equipe!",
      text: `Faltam somente ${summary.remaining.toLocaleString("pt-BR")} pedidos para conquistar ${summary.goalLabel}.`
    };
  }

  if (projectedRatio >= 1) {
    return {
      tone: "positive",
      title: "Projeção acima da meta",
      text: `Mantendo o ritmo atual, o mês fecha cerca de ${Math.max(0, projectionDifference).toLocaleString("pt-BR")} pedidos acima do alvo.`
    };
  }

  if (projectedRatio >= 0.9) {
    return {
      tone: "warning",
      title: "A meta está ao alcance",
      text: `Uma aceleração para ${summary.requiredDaily.toLocaleString("pt-BR")} pedidos por dia coloca ${summary.goalLabel} no placar.`
    };
  }

  return {
    tone: "boost",
    title: "Hora de acelerar o ritmo",
    text: `A projeção atual é ${summary.projectedOrders.toLocaleString("pt-BR")}. Precisamos de ${summary.requiredDaily.toLocaleString("pt-BR")} pedidos por dia para chegar à meta.`
  };
}

export function LiveMode(props: {
  data: DashboardData;
  lastOrder: NewOrderEvent | null;
  pulseKey: number;
  increment: LiveIncrementEvent | null;
  refreshing: boolean;
  notice?: string;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const count = useAnimatedNumber(props.data.summary.orders, 1000);
  const clock = useClock();
  const progress = Math.min(100, props.data.summary.progress);
  const circumference = 2 * Math.PI * 76;
  const encouragement = liveEncouragement(props.data);

  return (
    <section className={`live-mode ${props.increment ? "live-mode--pulse" : ""}`}>
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
        <div className="live-header__actions">
          <button className="button button--secondary live-refresh-button" onClick={props.onRefresh} disabled={props.refreshing}>
            <RefreshCw size={18} className={props.refreshing ? "spin" : ""} />
            <span>{props.refreshing ? "Atualizando..." : "Atualizar agora"}</span>
          </button>
          <button className="button button--secondary" onClick={props.onClose}>
            <Minimize2 size={18} /> <span>Sair da tela cheia</span>
          </button>
        </div>
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
              {props.increment && (
                <em key={`counter-${props.increment.id}`} className="live-counter-increment" aria-live="polite">
                  +{props.increment.amount.toLocaleString("pt-BR")}
                </em>
              )}
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
              <Percent size={21} />
              <span>Meta atingida</span>
              <strong>{props.data.summary.progress.toLocaleString("pt-BR")}%</strong>
            </div>
            <div>
              <TrendingUp size={21} />
              <span>Projeção do mês</span>
              <strong>{props.data.summary.projectedOrders.toLocaleString("pt-BR")}</strong>
            </div>
            <div>
              <span>Meta diária</span>
              <strong>{props.data.summary.dailyGoal > 0
                ? `${props.data.summary.todayOrders.toLocaleString("pt-BR")}/${props.data.summary.dailyGoal.toLocaleString("pt-BR")}`
                : "—"}</strong>
              <small>{props.data.goals.allCompleted
                ? "MÊS CONCLUÍDO"
                : props.data.summary.dailyGoalAchieved
                  ? "ATINGIDA"
                  : props.data.summary.dailyGoal > 0
                    ? `faltam ${props.data.summary.dailyGoalRemaining}`
                    : "SEM ALVO"}</small>
            </div>
            <div>
              <Clock3 size={21} />
              <span>Tempo restante</span>
              <strong className="live-targets__time">{formatRemainingTime(props.data.summary.monthEndsAt, clock)}</strong>
            </div>
          </div>

          <div className={`live-encouragement live-encouragement--${encouragement.tone}`}>
            <Sparkles size={22} />
            <div><strong>{encouragement.title}</strong><span>{encouragement.text}</span></div>
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
          <OrdersChart data={props.data.chart} compact mode="daily" liveIncrement={props.increment} />
        </div>
      </main>

      <LiveCoachMascot data={props.data} increment={props.increment} />
      {props.notice && <div className="live-toast">{props.notice}</div>}
      {props.increment && <div key={`wave-${props.pulseKey}`} className="order-wave" />}
    </section>
  );
}
