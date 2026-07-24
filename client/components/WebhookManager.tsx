import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  FlaskConical,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Webhook
} from "lucide-react";
import { api } from "../api";
import type { WebhookEventItem, WebhookEventStatus, WebhookManagement } from "../types";

const filters = [
  ["all", "Todos"],
  ["processed", "Processados"],
  ["pending", "Pendentes"],
  ["retry", "Retentativas"],
  ["error", "Erros"],
  ["ignored", "Ignorados"]
] as const;

const statusLabels: Record<WebhookEventStatus, string> = {
  pending: "Pendente",
  processing: "Processando",
  processed: "Processado",
  retry: "Retentativa",
  error: "Erro",
  ignored: "Ignorado"
};

function statusTone(status: WebhookEventStatus): string {
  if (status === "processed") return "success";
  if (status === "error") return "danger";
  if (status === "retry" || status === "pending" || status === "processing") return "warning";
  return "neutral";
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "Ainda não recebido";
}

function eventLabel(event: WebhookEventItem): string {
  if (event.scopeName === "diagnostic") return "Teste interno";
  return `${event.scopeName} · ${event.action}`;
}

export function WebhookManager() {
  const [data, setData] = useState<WebhookManagement | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (selectedFilter = filter, silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await api.webhooks(selectedFilter));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar webhooks.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load(filter);
    const interval = window.setInterval(() => void load(filter, true), 15_000);
    return () => window.clearInterval(interval);
  }, [filter, load]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const health = useMemo(() => {
    if (!data?.connected) return { label: "Loja desconectada", tone: "danger", detail: "Conecte a Tray para receber eventos." };
    if (data.state === "attention") return { label: "Requer atenção", tone: "danger", detail: "Existem eventos com erro ou aguardando nova tentativa." };
    if (data.state === "receiving") return { label: "Pipeline operacional", tone: "success", detail: "Eventos estão chegando e sendo processados." };
    return { label: "Aguardando eventos", tone: "warning", detail: "A URL está pronta, mas nenhum evento real foi observado ainda." };
  }, [data]);

  async function copyEndpoint() {
    if (!data?.endpointUrl) return;
    await navigator.clipboard.writeText(data.endpointUrl);
    setMessage("URL do webhook copiada.");
  }

  async function testPipeline() {
    setActionLoading("test");
    try {
      const result = await api.testWebhookPipeline();
      setData(result.management);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no teste interno.");
    } finally {
      setActionLoading("");
    }
  }

  async function retryFailed() {
    setActionLoading("retry-all");
    try {
      const result = await api.retryFailedWebhooks();
      setData(result.management);
      setMessage(result.queued > 0 ? `${result.queued} evento(s) enviado(s) para reprocessamento.` : "Nenhuma falha pendente.");
      window.setTimeout(() => void load(filter, true), 1800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao reprocessar eventos.");
    } finally {
      setActionLoading("");
    }
  }

  async function reprocess(id: string) {
    setActionLoading(id);
    try {
      await api.reprocessWebhook(id);
      setMessage("Evento enviado para reprocessamento.");
      window.setTimeout(() => void load(filter, true), 1400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao reprocessar evento.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <section className="webhook-console">
      {message && <div className="form-message webhook-console__message">{message}</div>}

      <article className="panel webhook-hero">
        <div className="webhook-hero__icon"><Webhook size={27} /></div>
        <div className="webhook-hero__copy">
          <span className="eyebrow">CENTRAL DE EVENTOS</span>
          <h2>Gerenciamento de webhooks</h2>
          <p>Monitore recebimentos, falhas, retentativas e o processamento local das notificações enviadas pela Tray.</p>
        </div>
        <div className={`webhook-health webhook-health--${health.tone}`}>
          {health.tone === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <div><strong>{health.label}</strong><span>{health.detail}</span></div>
        </div>
      </article>

      <section className="webhook-metrics">
        <article className="panel webhook-metric">
          <Activity size={19} />
          <span>Últimas 24 horas</span>
          <strong>{data?.stats.last24h ?? 0}</strong>
          <small>eventos recebidos</small>
        </article>
        <article className="panel webhook-metric">
          <CheckCircle2 size={19} />
          <span>Processados</span>
          <strong>{data?.stats.processed ?? 0}</strong>
          <small>concluídos com sucesso</small>
        </article>
        <article className="panel webhook-metric">
          <RotateCcw size={19} />
          <span>Na fila</span>
          <strong>{(data?.stats.pending ?? 0) + (data?.stats.processing ?? 0) + (data?.stats.retry ?? 0)}</strong>
          <small>pendentes ou em retentativa</small>
        </article>
        <article className="panel webhook-metric webhook-metric--danger">
          <AlertTriangle size={19} />
          <span>Erros</span>
          <strong>{data?.stats.error ?? 0}</strong>
          <small>exigem análise</small>
        </article>
      </section>

      <section className="webhook-grid">
        <article className="panel webhook-config">
          <div className="panel__header">
            <div><span className="eyebrow">ENDPOINT ATIVO</span><h2>Recebimento Tray</h2></div>
            <span className={`status ${data?.tokenProtected ? "status--success" : "status--warning"}`}>
              <ShieldCheck size={13} /> {data?.tokenProtected ? "Protegido por token" : "Sem token"}
            </span>
          </div>
          <div className="webhook-endpoint">
            <code>{data?.endpointUrl || "Carregando..."}</code>
            <button className="icon-button" onClick={() => void copyEndpoint()} disabled={!data?.endpointUrl} title="Copiar URL">
              <Copy size={16} />
            </button>
          </div>
          <div className="webhook-config__details">
            <div><span>Último recebimento</span><strong>{formatDate(data?.lastReceivedAt ?? null)}</strong></div>
            <div><span>Ativação observada</span><strong>{data?.activationObserved ? "Sim, eventos reais recebidos" : "Ainda não confirmada por evento real"}</strong></div>
          </div>
          <p className="webhook-note">
            A Tray ativa e altera a URL no nível do aplicativo mediante chamado. Este painel administra o recebimento, armazenamento e reprocessamento local, mas não ativa ou desativa o serviço dentro da Tray.
          </p>
          <div className="form-actions">
            <button className="button button--secondary" onClick={() => void testPipeline()} disabled={Boolean(actionLoading)}>
              <FlaskConical size={17} className={actionLoading === "test" ? "spin" : ""} /> Testar pipeline interno
            </button>
            <button className="button button--secondary" onClick={() => void retryFailed()} disabled={Boolean(actionLoading)}>
              <RotateCcw size={17} className={actionLoading === "retry-all" ? "spin" : ""} /> Reprocessar falhas
            </button>
            <button className="button button--secondary" onClick={() => void load(filter)} disabled={loading || Boolean(actionLoading)}>
              <RefreshCw size={17} className={loading ? "spin" : ""} /> Atualizar
            </button>
          </div>
        </article>

        <article className="panel webhook-events">
          <div className="panel__header webhook-events__header">
            <div><span className="eyebrow">HISTÓRICO LOCAL</span><h2>Eventos recebidos</h2></div>
            <span className="webhook-total">{data?.stats.total ?? 0} total</span>
          </div>

          <div className="webhook-filters">
            {filters.map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="webhook-table-wrap">
            <table className="webhook-table">
              <thead><tr><th>Recebido</th><th>Evento</th><th>Registro</th><th>Status</th><th>Tentativas</th><th /></tr></thead>
              <tbody>
                {data?.events.map((event) => (
                  <tr key={event.id}>
                    <td><strong>{new Date(event.receivedAt).toLocaleDateString("pt-BR")}</strong><small>{new Date(event.receivedAt).toLocaleTimeString("pt-BR")}</small></td>
                    <td><strong>{eventLabel(event)}</strong>{event.error && <small className="webhook-error" title={event.error}>{event.error}</small>}</td>
                    <td><code>#{event.scopeId}</code><small>Loja {event.sellerId}</small></td>
                    <td><span className={`status status--${statusTone(event.status)}`}>{statusLabels[event.status]}</span></td>
                    <td>{event.attempts}</td>
                    <td>
                      {event.scopeName !== "diagnostic" && (
                        <button className="icon-button" onClick={() => void reprocess(event.id)} disabled={Boolean(actionLoading)} title="Reprocessar evento">
                          <RotateCcw size={15} className={actionLoading === event.id ? "spin" : ""} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && (data?.events.length ?? 0) === 0 && <div className="empty-state">Nenhum evento encontrado neste filtro.</div>}
            {loading && <div className="loading-panel">Carregando eventos...</div>}
          </div>
        </article>
      </section>
    </section>
  );
}
