import { ShoppingBag } from "lucide-react";
import type { DashboardData } from "../types";

function statusClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized.includes("CANCEL")) return "status status--danger";
  if (normalized.includes("PEND") || normalized.includes("AGUARD")) return "status status--warning";
  if (normalized.includes("FINAL") || normalized.includes("APROV") || normalized.includes("ENVI")) return "status status--success";
  return "status";
}

export function RecentOrders({ orders }: { orders: DashboardData["recentOrders"] }) {
  return (
    <article className="panel orders-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">ÚLTIMAS MOVIMENTAÇÕES</span>
          <h2>Pedidos recentes</h2>
        </div>
        <ShoppingBag size={20} className="muted-icon" />
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">Nenhum pedido sincronizado neste mês.</div>
      ) : (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Canal</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.trayOrderId}>
                  <td>#{order.trayOrderId}</td>
                  <td>{new Date(order.modifiedAt || order.orderDate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{order.pointSale || "Tray"}</td>
                  <td>{order.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td><span className={statusClass(order.status)}>{order.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
