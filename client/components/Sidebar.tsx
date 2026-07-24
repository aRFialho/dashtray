import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Gauge,
  LogOut,
  PlugZap,
  Settings2,
  Target
} from "lucide-react";
import { Brand } from "./Brand";

export type ViewName = "dashboard" | "goals" | "integration";

type SidebarProps = {
  collapsed: boolean;
  view: ViewName;
  onToggle: () => void;
  onChangeView: (view: ViewName) => void;
  onLogout: () => void;
};

const items: Array<{ id: ViewName; label: string; icon: typeof Gauge }> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "goals", label: "Metas", icon: Target },
  { id: "integration", label: "Integração Tray", icon: PlugZap }
];

export function Sidebar({ collapsed, view, onToggle, onChangeView, onLogout }: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar__top">
        <Brand compact={collapsed} />
        <button className="icon-button sidebar__collapse" onClick={onToggle} aria-label="Recolher menu">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "nav-item--active" : ""}`}
              onClick={() => onChangeView(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__bottom">
        <div className="system-status" title="Conexão e atualização automática ativas">
          <span className="system-status__dot" />
          {!collapsed && (
            <div>
              <strong>Sistema online</strong>
              <span>Atualização automática</span>
            </div>
          )}
        </div>
        <button className="nav-item" onClick={onLogout} title={collapsed ? "Sair" : undefined}>
          <LogOut size={20} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
