import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save, Target, Trash2, Trophy } from "lucide-react";
import type { DashboardData, GoalLevelInput } from "../types";

type DraftLevel = { label: string; targetOrders: string };

function draftsFromDashboard(data: DashboardData): DraftLevel[] {
  if (data.goals.levels.length > 0) {
    return data.goals.levels.map((level) => ({
      label: level.label,
      targetOrders: String(level.targetOrders)
    }));
  }
  return [{ label: "Meta 1", targetOrders: "" }];
}

export function GoalSettings(props: {
  data: DashboardData;
  month: string;
  onSave: (levels: GoalLevelInput[]) => Promise<void>;
}) {
  const [levels, setLevels] = useState<DraftLevel[]>(() => draftsFromDashboard(props.data));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const levelsSignature = props.data.goals.levels
    .map((level) => `${level.id}:${level.label}:${level.targetOrders}`)
    .join("|");

  useEffect(() => setLevels(draftsFromDashboard(props.data)), [levelsSignature, props.month]);

  const normalizedPreview = useMemo(() => levels
    .map((level, index) => ({
      label: level.label.trim() || `Meta ${index + 1}`,
      targetOrders: Number(level.targetOrders || 0)
    }))
    .filter((level) => level.targetOrders > 0)
    .sort((a, b) => a.targetOrders - b.targetOrders), [levels]);

  const previewActive = normalizedPreview.find((level) => props.data.summary.orders < level.targetOrders)
    ?? normalizedPreview.at(-1)
    ?? null;

  function updateLevel(index: number, field: keyof DraftLevel, value: string) {
    setLevels((current) => current.map((level, levelIndex) => (
      levelIndex === index ? { ...level, [field]: value } : level
    )));
  }

  function addLevel() {
    setLevels((current) => current.length >= 8
      ? current
      : [...current, { label: `Meta ${current.length + 1}`, targetOrders: "" }]);
  }

  function removeLevel(index: number) {
    setLevels((current) => current.filter((_, levelIndex) => levelIndex !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (normalizedPreview.some((level, index) => index > 0 && level.targetOrders === normalizedPreview[index - 1]?.targetOrders)) {
        throw new Error("Cada nível precisa ter uma quantidade diferente de pedidos.");
      }
      await props.onSave(normalizedPreview);
      setMessage("Níveis de meta salvos e publicados no painel ao vivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-layout settings-layout--goals">
      <article className="panel settings-card">
        <div className="settings-card__icon"><Target size={26} /></div>
        <span className="eyebrow">CONFIGURAÇÃO ADMINISTRATIVA</span>
        <h2>Níveis de meta mensal</h2>
        <p>Crie até oito marcos em ordem crescente. Ao atingir um nível, o painel comemora e avança automaticamente para o próximo.</p>

        <form className="settings-form" onSubmit={submit}>
          <label>
            <span>Mês de referência</span>
            <input value={props.month} disabled />
          </label>

          <div className="goal-level-editor">
            {levels.map((level, index) => (
              <div className="goal-level-row" key={`${index}-${props.month}`}>
                <div className="goal-level-row__number">{index + 1}</div>
                <label>
                  <span>Nome do nível</span>
                  <input
                    value={level.label}
                    onChange={(event) => updateLevel(index, "label", event.target.value)}
                    placeholder={`Meta ${index + 1}`}
                    maxLength={60}
                    required
                  />
                </label>
                <label>
                  <span>Quantidade de pedidos</span>
                  <input
                    type="number"
                    min="1"
                    max="10000000"
                    value={level.targetOrders}
                    onChange={(event) => updateLevel(index, "targetOrders", event.target.value)}
                    placeholder="Ex.: 1500"
                    required
                  />
                </label>
                <button
                  type="button"
                  className="icon-button goal-level-row__remove"
                  onClick={() => removeLevel(index)}
                  aria-label={`Remover ${level.label || `meta ${index + 1}`}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="button button--secondary" onClick={addLevel} disabled={levels.length >= 8}>
            <Plus size={17} /> Adicionar nível
          </button>
          <button className="button button--primary" disabled={saving || normalizedPreview.length === 0}>
            <Save size={17} /> {saving ? "Salvando..." : "Salvar níveis"}
          </button>
          {message && <div className="form-message">{message}</div>}
        </form>
      </article>

      <article className="panel settings-preview goal-preview">
        <span className="eyebrow">ESCADA DE METAS</span>
        <div className="goal-preview__headline">
          <Trophy size={25} />
          <div>
            <span>Meta ativa na prévia</span>
            <h2>{previewActive?.targetOrders.toLocaleString("pt-BR") ?? "0"}</h2>
            <p>{previewActive?.label ?? "Adicione ao menos um nível"}</p>
          </div>
        </div>

        <div className="goal-preview__levels">
          {normalizedPreview.map((level, index) => {
            const achieved = props.data.summary.orders >= level.targetOrders;
            const active = previewActive?.targetOrders === level.targetOrders && !achieved;
            return (
              <div className={`goal-preview__level ${achieved ? "is-achieved" : ""} ${active ? "is-active" : ""}`} key={`${level.label}-${level.targetOrders}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{level.label}</strong>
                  <small>{level.targetOrders.toLocaleString("pt-BR")} pedidos</small>
                </div>
              </div>
            );
          })}
        </div>

        <div className="settings-preview__bar">
          <div style={{ width: `${Math.min(100, previewActive && previewActive.targetOrders > 0 ? (props.data.summary.orders / previewActive.targetOrders) * 100 : 0)}%` }} />
        </div>
        <strong>{props.data.summary.orders.toLocaleString("pt-BR")} pedidos atuais</strong>
      </article>
    </section>
  );
}
