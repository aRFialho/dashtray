import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DashboardData } from "../types";

type ChartMode = "cumulative" | "daily";

const tooltipStyle = {
  background: "#101827",
  border: "1px solid #283653",
  borderRadius: 14,
  boxShadow: "0 18px 45px rgba(0,0,0,.35)"
};

export function OrdersChart({
  data,
  compact = false,
  mode = "cumulative"
}: {
  data: DashboardData["chart"];
  compact?: boolean;
  mode?: ChartMode;
}) {
  if (mode === "daily") {
    return (
      <div className={`chart-shell ${compact ? "chart-shell--compact" : ""}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="dailyOrdersFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4c8cff" stopOpacity={1} />
                <stop offset="100%" stopColor="#275bd8" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 8" stroke="rgba(132,151,188,.14)" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#7f8da8", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7f8da8", fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(59,123,255,.07)" }}
              labelFormatter={(day) => `Dia ${day}`}
              formatter={(value) => [Number(value ?? 0).toLocaleString("pt-BR"), "Pedidos no dia"]}
            />
            <Bar
              dataKey="dailyOrders"
              fill="url(#dailyOrdersFill)"
              radius={[8, 8, 2, 2]}
              maxBarSize={42}
              animationDuration={900}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

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
            contentStyle={tooltipStyle}
            labelFormatter={(day) => `Dia ${day}`}
            formatter={(value, name) => [Number(value ?? 0).toLocaleString("pt-BR"), name === "orders" ? "Pedidos acumulados" : "Ritmo da meta"]}
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
