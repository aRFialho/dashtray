import type { LucideIcon } from "lucide-react";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";

export function MetricCard(props: {
  label: string;
  value: number;
  suffix?: string;
  description: string;
  icon: LucideIcon;
  tone: "blue" | "purple" | "green" | "amber";
  decimals?: number;
}) {
  const Icon = props.icon;
  const animated = useAnimatedNumber(props.value);
  return (
    <article className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${props.tone}`}>
        <Icon size={22} />
      </div>
      <div className="metric-card__content">
        <span>{props.label}</span>
        <strong>
          {animated.toLocaleString("pt-BR", {
            maximumFractionDigits: props.decimals ?? 0,
            minimumFractionDigits: props.decimals ?? 0
          })}
          {props.suffix}
        </strong>
        <small>{props.description}</small>
      </div>
    </article>
  );
}
