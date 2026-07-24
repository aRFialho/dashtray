import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DashboardData } from "../types";

export function OrdersChart({ data, compact = false }: { data: DashboardData["chart"]; compact?: boolean }) {
  return (
    <div className={`chart-shell ${compact ? "chart-shell--compact" : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b7bff" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#3b7bff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 8" stroke="rgba(132,151,188,.14)" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#7f8da8", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7f8da8", fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "#101827",
              border: "1px solid #283653",
              borderRadius: 14,
              boxShadow: "0 18px 45px rgba(0,0,0,.35)"
            }}
            labelFormatter={(day) => `Dia ${day}`}
            formatter={(value, name) => [Number(value ?? 0).toLocaleString("pt-BR"), name === "orders" ? "Pedidos" : "Ritmo da meta"]}
          />
          <Area type="monotone" dataKey="orders" stroke="#3b7bff" strokeWidth={3} fill="url(#ordersFill)" animationDuration={900} />
          <Line
            type="monotone"
            dataKey="target"
            stroke="#a879ff"
            strokeWidth={2}
            strokeDasharray="7 7"
            dot={false}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
