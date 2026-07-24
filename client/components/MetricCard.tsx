import type { LucideIcon } from "lucide-react";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";

export function MetricCard(props: {
  label: string;
  value: number | string;
  suffix?: string;
  description: string;
  icon: LucideIcon;
  tone: "blue" | "purple" | "green" | "amber" | "cyan" | "red";
  decimals?: number;
}) {
  const Icon = props.icon;
  const numericValue = typeof props.value === "number" ? props.value : 0;
  const animated = useAnimatedNumber(numericValue);
  const renderedValue = typeof props.value === "number"
    ? animated.toLocaleString("pt-BR", {
        maximumFractionDigits: props.decimals ?? 0,
        minimumFractionDigits: props.decimals ?? 0
      })
    : props.value;

  return (
    <article className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${props.tone}`}>
        <Icon size={22} />
      </div>
      <div className="metric-card__content">
        <span>{props.label}</span>
        <strong>
          {renderedValue}
          {props.suffix}
        </strong>
        <small>{props.description}</small>
      </div>
    </article>
  );
}
