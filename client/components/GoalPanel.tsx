import { Check, CheckCircle2, Flag, PencilLine, TrendingUp } from "lucide-react";
import type { DashboardData } from "../types";

export function GoalPanel({ data, onEdit }: { data: DashboardData; onEdit: () => void }) {
  const progress = Math.min(100, data.summary.progress);
  const active = data.goals.activeLevel;

  return (
    <article className="panel goal-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">PROGRESSÃO DE META</span>
          <h2>{data.goals.allCompleted ? "Todas as metas atingidas" : active?.label ?? "Configure suas metas"}</h2>
        </div>
        <button className="text-button" onClick={onEdit}>
          <PencilLine size={16} /> Editar níveis
        </button>
      </div>

      <div className="goal-panel__summary">
        <div>
          <span>Meta atual</span>
          <strong>{data.summary.goal.toLocaleString("pt-BR")}</strong>
          <small>{data.summary.goalLabel}</small>
        </div>
        <div>
          <span>Níveis concluídos</span>
          <strong>{data.goals.completedCount}/{data.goals.totalCount}</strong>
          <small>{data.goals.allCompleted ? "escada completa" : "progresso mensal"}</small>
        </div>
        <div>
          <span>Projeção</span>
          <strong>{data.summary.projectedOrders.toLocaleString("pt-BR")}</strong>
          <small>até o fim do mês</small>
        </div>
        <div>
          <span>Ritmo necessário</span>
          <strong>{data.summary.requiredDaily.toLocaleString("pt-BR")}</strong>
          <small>pedidos por dia</small>
        </div>
      </div>

      {data.goals.levels.length > 0 && (
        <div className="goal-ladder" aria-label="Níveis de meta">
          {data.goals.levels.map((level) => {
            const isActive = active?.id === level.id && !level.achieved;
            return (
              <div className={`goal-ladder__item ${level.achieved ? "is-achieved" : ""} ${isActive ? "is-active" : ""}`} key={level.id}>
                <div className="goal-ladder__marker">
                  {level.achieved ? <Check size={14} /> : <Flag size={13} />}
                </div>
                <div>
                  <strong>{level.label}</strong>
                  <span>{level.targetOrders.toLocaleString("pt-BR")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="progress-block">
        <div className="progress-block__labels">
          <span>{data.summary.progress.toLocaleString("pt-BR")}% da meta atual</span>
          <span>{data.summary.remaining.toLocaleString("pt-BR")} restantes</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={`goal-insight ${data.goals.allCompleted ? "goal-insight--done" : ""}`}>
        {data.goals.allCompleted ? <CheckCircle2 size={19} /> : <TrendingUp size={19} />}
        <span>
          {data.goals.allCompleted
            ? "Escada completa. O contador continua registrando o excedente do mês."
            : data.summary.projectedOrders >= data.summary.goal && data.summary.goal > 0
              ? `A projeção está acima de ${data.summary.goalLabel}.`
              : data.goals.nextLevel
                ? `Depois de ${data.summary.goalLabel}, o próximo marco será ${data.goals.nextLevel.label}.`
                : "Acompanhe o ritmo diário para corrigir a rota cedo."}
        </span>
      </div>
    </article>
  );
}
