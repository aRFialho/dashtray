import { Expand, Menu, RefreshCw } from "lucide-react";

export function Header(props: {
  month: string;
  onMonthChange: (month: string) => void;
  onSync: () => void;
  syncing: boolean;
  onLiveMode: () => void;
  onToggleSidebar: () => void;
  email: string;
}) {
  return (
    <header className="topbar">
      <div className="topbar__title">
        <button className="icon-button topbar__mobile-menu" onClick={props.onToggleSidebar} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <div>
          <span className="eyebrow">CONTROLE DE PERFORMANCE</span>
          <h1>Pedidos e metas</h1>
        </div>
      </div>

      <div className="topbar__actions">
        <label className="month-picker">
          <span>Mês</span>
          <input type="month" value={props.month} onChange={(event) => props.onMonthChange(event.target.value)} />
        </label>
        <button className="button button--secondary" onClick={props.onSync} disabled={props.syncing}>
          <RefreshCw size={17} className={props.syncing ? "spin" : ""} />
          {props.syncing ? "Sincronizando" : "Atualizar"}
        </button>
        <button className="button button--primary" onClick={props.onLiveMode}>
          <Expand size={17} />
          Tela ao vivo
        </button>
        <div className="admin-chip" title={props.email}>
          <span>{props.email.slice(0, 2).toUpperCase()}</span>
        </div>
      </div>
    </header>
  );
}
