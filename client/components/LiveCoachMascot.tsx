import { useEffect, useMemo, useState } from "react";
import type { DashboardData, LiveIncrementEvent } from "../types";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia, equipe! Vamos acelerar esse placar! ☀️";
  if (hour < 18) return "Boa tarde, equipe! Foco total na próxima meta! ⚡";
  return "Boa noite, equipe! Fechando o dia com força! 🌙";
}

function regularMessages(data: DashboardData): string[] {
  const { summary, goals } = data;
  const messages = [greeting()];

  if (goals.allCompleted) {
    messages.push("Todas as metas foram conquistadas! Agora é ampliar o recorde! 🏆");
    messages.push("Meta final superada. Cada novo pedido aumenta nossa marca! 🔥");
  } else if (summary.goal <= 0) {
    messages.push("Cada pedido movimenta o time. Bora crescer esse número! 🚀");
  } else if (summary.remaining === 0) {
    messages.push(`${summary.goalLabel} atingida! Próximo nível ativado! 🎯`);
  } else if (summary.projectedOrders >= summary.goal) {
    messages.push(
      `A projeção aponta ${summary.projectedOrders.toLocaleString("pt-BR")} pedidos. Estamos no caminho da meta! 🚀`
    );
    messages.push("O ritmo está forte. Vamos manter até o fechamento! 🔥");
  } else if (summary.remaining <= 5) {
    messages.push(`Faltam só ${summary.remaining.toLocaleString("pt-BR")} pedidos. Reta final! 💪`);
    messages.push("A meta está logo ali. Vamos buscar os últimos pedidos! 🎯");
  } else if (summary.progress >= 80) {
    messages.push(`Já atingimos ${summary.progress.toLocaleString("pt-BR")}% da meta! ⚡`);
    messages.push(`Faltam ${summary.remaining.toLocaleString("pt-BR")} pedidos. Está muito perto! 🔥`);
  } else if (summary.progress >= 50) {
    messages.push(`Mais da metade concluída: ${summary.orders.toLocaleString("pt-BR")} pedidos no placar! 🎯`);
    messages.push("Consistência agora faz a diferença. Bora manter o ritmo! 🚀");
  } else {
    messages.push(`Já temos ${summary.orders.toLocaleString("pt-BR")} pedidos. Cada entrada conta! 💥`);
    messages.push("Vamos crescer esse placar pedido por pedido! 🚀");
  }

  if (summary.goal > 0 && summary.remaining > 0) {
    messages.push(
      `Faltam ${summary.remaining.toLocaleString("pt-BR")} para ${summary.goalLabel}, com meta de ${summary.goal.toLocaleString("pt-BR")}.`
    );
  }

  if (summary.projectedOrders > 0) {
    messages.push(`Projeção atual: ${summary.projectedOrders.toLocaleString("pt-BR")} pedidos no fechamento.`);
  }

  return messages;
}

function reactionMessage(amount: number): string {
  if (amount <= 1) {
    return Math.random() > 0.5
      ? "Novo pedido entrou! Bora, time! 🎉"
      : "Mais um pedido no placar! 🔥";
  }

  return Math.random() > 0.5
    ? `Mais ${amount} pedidos entraram! O time está voando! 🔥`
    : `+${amount} no placar! Excelente sequência, equipe! 🚀`;
}

export function LiveCoachMascot({
  data,
  increment
}: {
  data: DashboardData;
  increment: LiveIncrementEvent | null;
}) {
  const messages = useMemo(() => regularMessages(data), [data]);
  const [messageIndex, setMessageIndex] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const mascotUrl = `${import.meta.env.BASE_URL}mascot/drossi-live.gif`;

  useEffect(() => {
    setMessageIndex(0);
  }, [messages]);

  useEffect(() => {
    if (reaction) return;
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % Math.max(1, messages.length));
    }, 7000);
    return () => window.clearInterval(timer);
  }, [messages.length, reaction]);

  useEffect(() => {
    if (!increment || increment.amount <= 0) return;
    setReaction(reactionMessage(increment.amount));
    const timer = window.setTimeout(() => setReaction(null), 5500);
    return () => window.clearTimeout(timer);
  }, [increment?.id, increment?.amount]);

  return (
    <aside className={`live-coach ${reaction ? "live-coach--reacting" : ""}`} aria-live="polite">
      <div className="live-coach__bubble" key={reaction ?? `${messageIndex}-${messages[messageIndex]}`}>
        <span>{reaction ?? messages[messageIndex] ?? greeting()}</span>
      </div>

      <div className="live-coach__character">
        {reaction && increment && increment.amount > 0 && (
          <strong className="live-coach__increment">+{increment.amount.toLocaleString("pt-BR")}</strong>
        )}

        {!imageError ? (
          <img
            src={mascotUrl}
            alt="Personagem incentivando a equipe"
            draggable={false}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="live-coach__image-warning" role="status">
            <strong>Personagem</strong>
            <span>GIF não encontrado</span>
            <small>{mascotUrl}</small>
          </div>
        )}
      </div>
    </aside>
  );
}
