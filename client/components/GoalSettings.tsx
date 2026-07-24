import { FormEvent, useEffect, useState } from "react";
import { Save, Target } from "lucide-react";
import type { DashboardData } from "../types";

export function GoalSettings(props: {
  data: DashboardData;
  month: string;
  onSave: (target: number) => Promise<void>;
}) {
  const [target, setTarget] = useState(String(props.data.summary.goal || ""));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setTarget(String(props.data.summary.goal || "")), [props.data.summary.goal, props.month]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await props.onSave(Number(target));
      setMessage("Meta salva e publicada no painel ao vivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-layout">
      <article className="panel settings-card">
        <div className="settings-card__icon"><Target size={26} /></div>
        <span className="eyebrow">CONFIGURAÇÃO ADMINISTRATIVA</span>
        <h2>Meta mensal de pedidos</h2>
        <p>O valor alimenta o progresso, o ritmo ideal diário, a projeção e o modo de tela cheia.</p>

        <form className="settings-form" onSubmit={submit}>
          <label>
            <span>Mês de referência</span>
            <input value={props.month} disabled />
          </label>
          <label>
            <span>Número de pedidos da meta</span>
            <input
              type="number"
              min="0"
              max="10000000"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="Ex.: 1500"
              required
            />
          </label>
          <button className="button button--primary" disabled={saving}>
            <Save size={17} /> {saving ? "Salvando..." : "Salvar meta"}
          </button>
          {message && <div className="form-message">{message}</div>}
        </form>
      </article>

      <article className="panel settings-preview">
        <span className="eyebrow">PRÉVIA</span>
        <h2>{Number(target || 0).toLocaleString("pt-BR")}</h2>
        <p>pedidos definidos para {props.month}</p>
        <div className="settings-preview__bar">
          <div style={{ width: `${Math.min(100, Number(target) > 0 ? (props.data.summary.orders / Number(target)) * 100 : 0)}%` }} />
        </div>
        <strong>{props.data.summary.orders.toLocaleString("pt-BR")} pedidos atuais</strong>
      </article>
    </section>
  );
}
