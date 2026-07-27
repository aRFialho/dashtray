import { useEffect, type CSSProperties } from "react";
import { ArrowRight, CalendarCheck2, PartyPopper, Trophy, X } from "lucide-react";
import type { GoalAchievementEvent } from "../types";

function playCelebrationSound() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    void context.resume();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.12;
      oscillator.type = index === notes.length - 1 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.36);
    });
    window.setTimeout(() => void context.close(), 1_200);
  } catch {
    // O navegador pode bloquear áudio automático; a celebração visual continua.
  }
}

export function CelebrationOverlay({ event, onClose }: { event: GoalAchievementEvent; onClose: () => void }) {
  useEffect(() => {
    playCelebrationSound();
    const timeout = window.setTimeout(onClose, 9_000);
    return () => window.clearTimeout(timeout);
  }, [event.id, onClose]);

  const daily = event.type === "daily";

  return (
    <div
      className={`celebration ${daily ? "celebration--daily" : "celebration--monthly"}`}
      role="alertdialog"
      aria-live="assertive"
      aria-label={daily ? "Meta diária atingida" : `Meta ${event.label} atingida`}
    >
      <div className="celebration__flash" />
      <div className="confetti-field" aria-hidden="true">
        {Array.from({ length: 72 }, (_, index) => {
          const style = {
            "--x": `${(index * 37) % 100}%`,
            "--delay": `${(index % 12) * -0.12}s`,
            "--duration": `${2.4 + (index % 7) * 0.24}s`,
            "--spin": `${180 + (index % 8) * 90}deg`,
            "--drift": `${-90 + (index % 13) * 15}px`,
            "--hue": `${daily ? 145 + (index * 11) % 85 : (index * 47) % 360}`
          } as CSSProperties;
          return <span key={index} style={style} />;
        })}
      </div>

      <article className="celebration-card">
        <button className="celebration-card__close" onClick={onClose} aria-label="Fechar celebração">
          <X size={20} />
        </button>
        <div className="celebration-card__icon">
          {daily ? <CalendarCheck2 size={42} /> : <Trophy size={42} />}
        </div>
        <span className="celebration-card__eyebrow">
          <PartyPopper size={16} /> {daily ? "META DIÁRIA ATINGIDA!" : "META ATINGIDA!"}
        </span>
        <h2>{daily ? "Ritmo do dia conquistado" : event.label}</h2>
        <strong>{event.targetOrders.toLocaleString("pt-BR")} pedidos</strong>
        <p>
          {daily
            ? `A equipe chegou a ${event.orderCount.toLocaleString("pt-BR")} pedidos hoje e cumpriu o ritmo necessário para ${event.goalLabel}.`
            : `Marco conquistado com ${event.orderCount.toLocaleString("pt-BR")} pedidos contabilizados no mês.`}
        </p>

        {daily ? (
          <div className="celebration-card__complete">
            Meta diária concluída. Cada novo pedido de hoje vira vantagem para a meta mensal! ⚡
          </div>
        ) : event.nextLevel ? (
          <div className="celebration-card__next">
            <span>Próximo nível</span>
            <div>
              <strong>{event.nextLevel.label}</strong>
              <ArrowRight size={18} />
              <b>{event.nextLevel.targetOrders.toLocaleString("pt-BR")}</b>
            </div>
          </div>
        ) : (
          <div className="celebration-card__complete">Escada de metas concluída. Excelente fechamento! 🏆</div>
        )}
      </article>
    </div>
  );
}

