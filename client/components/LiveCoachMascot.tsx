import { useEffect, useMemo, useState } from "react";

type DashboardLike = {
  summary?: {
    orders?: number;
    goal?: number;
    remaining?: number;
    percentage?: number;
    projectedOrders?: number;
    finalGoalReached?: boolean;
    completedLevels?: number;
    totalLevels?: number;
  };
};

type IncrementLike =
  | number
  | null
  | undefined
  | {
      amount?: number;
      delta?: number;
      value?: number;
      count?: number;
      id?: string | number;
      sequence?: string | number;
      createdAt?: string;
    };

function readIncrement(increment: IncrementLike): number {
  if (typeof increment === "number") return Math.max(0, increment);
  if (!increment || typeof increment !== "object") return 0;

  const value = increment.amount ?? increment.delta ?? increment.value ?? increment.count ?? 0;
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}

function incrementIdentity(increment: IncrementLike): string {
  if (typeof increment === "number") return String(increment);
  if (!increment || typeof increment !== "object") return "0";
  return String(
    increment.id ??
      increment.sequence ??
      increment.createdAt ??
      `${readIncrement(increment)}-${Date.now()}`
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia, equipe! Vamos acelerar esse placar! ☀️";
  if (hour < 18) return "Boa tarde, equipe! Foco total na próxima meta! ⚡";
  return "Boa noite, equipe! Fechando o dia com força! 🌙";
}

function regularMessages(data: DashboardLike): string[] {
  const summary = data.summary ?? {};
  const orders = Number(summary.orders ?? 0);
  const goal = Number(summary.goal ?? 0);
  const remaining = Math.max(0, Number(summary.remaining ?? Math.max(0, goal - orders)));
  const percentage = Number(summary.percentage ?? (goal > 0 ? (orders / goal) * 100 : 0));
  const projection = Number(summary.projectedOrders ?? orders);
  const finalGoalReached = Boolean(summary.finalGoalReached);

  const messages = [greeting()];

  if (finalGoalReached) {
    messages.push("Todas as metas foram conquistadas! Agora é ampliar o recorde! 🏆");
    messages.push("Meta final superada. Cada novo pedido aumenta nossa marca! 🔥");
  } else if (goal <= 0) {
    messages.push("Cada pedido movimenta o time. Bora crescer esse número! 🚀");
  } else if (orders >= goal) {
    messages.push(`Meta de ${goal.toLocaleString("pt-BR")} atingida! Próximo nível ativado! 🎯`);
  } else if (projection >= goal) {
    messages.push(`A projeção aponta ${projection.toLocaleString("pt-BR")} pedidos. Estamos no caminho da meta! 🚀`);
    messages.push("O ritmo está forte. Vamos manter até o fechamento! 🔥");
  } else if (remaining <= 5) {
    messages.push(`Faltam só ${remaining.toLocaleString("pt-BR")} pedidos. Reta final! 💪`);
    messages.push("A meta está logo ali. Vamos buscar os últimos pedidos! 🎯");
  } else if (percentage >= 80) {
    messages.push(`Já atingimos ${percentage.toFixed(1).replace(".", ",")}% da meta! ⚡`);
    messages.push(`Faltam ${remaining.toLocaleString("pt-BR")} pedidos. Está muito perto! 🔥`);
  } else if (percentage >= 50) {
    messages.push(`Mais da metade concluída: ${orders.toLocaleString("pt-BR")} pedidos no placar! 🎯`);
    messages.push("Consistência agora faz a diferença. Bora manter o ritmo! 🚀");
  } else {
    messages.push(`Já temos ${orders.toLocaleString("pt-BR")} pedidos. Cada entrada conta! 💥`);
    messages.push("Vamos crescer esse placar pedido por pedido! 🚀");
  }

  if (goal > 0 && remaining > 0) {
    messages.push(`Faltam ${remaining.toLocaleString("pt-BR")} para a meta ativa de ${goal.toLocaleString("pt-BR")}.`);
  }

  if (projection > 0) {
    messages.push(`Projeção atual: ${projection.toLocaleString("pt-BR")} pedidos no fechamento.`);
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

function mascotCandidates(): string[] {
  const base = document.querySelector("base")?.getAttribute("href") ?? "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;

  return [
    `${normalized}mascot/drossi-live.gif?v=161`,
    `${normalized}mascot/drossi-live.png?v=161`,
    `${normalized}mascot/download.gif?v=161`,
    `${normalized}mascot/download.png?v=161`
  ];
}

export function LiveCoachMascot({
  data,
  increment
}: {
  data: DashboardLike;
  increment?: IncrementLike;
}) {
  const messages = useMemo(() => regularMessages(data), [data]);
  const imageCandidates = useMemo(() => mascotCandidates(), []);
  const [messageIndex, setMessageIndex] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const amount = readIncrement(increment);
  const identity = incrementIdentity(increment);
  const imageSource = imageCandidates[imageIndex];
  const imageMissing = imageIndex >= imageCandidates.length;

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
    if (amount <= 0) return;
    setReaction(reactionMessage(amount));
    const timer = window.setTimeout(() => setReaction(null), 5500);
    return () => window.clearTimeout(timer);
  }, [identity, amount]);

  return (
    <aside className={`live-coach ${reaction ? "live-coach--reacting" : ""}`} aria-live="polite">
      <div className="live-coach__bubble" key={reaction ?? `${messageIndex}-${messages[messageIndex]}`}>
        <span>{reaction ?? messages[messageIndex] ?? greeting()}</span>
      </div>

      <div className="live-coach__character">
        {reaction && amount > 0 && <strong className="live-coach__increment">+{amount}</strong>}

        {!imageMissing && imageSource ? (
          <img
            src={imageSource}
            alt="Personagem incentivando a equipe"
            draggable={false}
            onError={() => setImageIndex((current) => current + 1)}
          />
        ) : (
          <div className="live-coach__image-warning" role="status">
            <strong>Personagem</strong>
            <span>Imagem não encontrada</span>
          </div>
        )}
      </div>
    </aside>
  );
}
