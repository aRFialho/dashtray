import { CheckCircle2, PencilLine, TrendingUp } from "lucide-react";
import type { DashboardData } from "../types";

export function GoalPanel({ data, onEdit }: { data: DashboardData; onEdit: () => void }) {
  const progress = Math.min(100, data.summary.progress);
  return (
    <article className="panel goal-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">META DO MÊS</span>
          <h2>Ritmo atual</h2>
        </div>
        <button className="text-button" onClick={onEdit}>
          <PencilLine size={16} /> Editar meta
        </button>
      </div>

      <div className="goal-panel__numbers">
        <div>
          <span>Meta definida</span>
          <strong>{data.summary.goal.toLocaleString("pt-BR")}</strong>
          <small>pedidos</small>
        </div>
        <div>
          <span>Projeção</span>
          <strong>{data.summary.projectedOrders.toLocaleString("pt-BR")}</strong>
          <small>até o fim do mês</small>
        </div>
      </div>

      <div className="progress-block">
        <div className="progress-block__labels">
          <span>{data.summary.progress.toLocaleString("pt-BR")}%</span>
          <span>{data.summary.remaining.toLocaleString("pt-BR")} restantes</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={`goal-insight ${data.summary.progress >= 100 ? "goal-insight--done" : ""}`}>
        {data.summary.progress >= 100 ? <CheckCircle2 size={19} /> : <TrendingUp size={19} />}
        <span>
          {data.summary.progress >= 100
            ? "Meta atingida. O contador continua registrando o excedente."
            : data.summary.projectedOrders >= data.summary.goal && data.summary.goal > 0
              ? "A projeção está acima da meta estabelecida."
              : "Acompanhe o ritmo diário para corrigir a rota cedo."}
        </span>
      </div>
    </article>
  );
}
