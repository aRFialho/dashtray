import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, KeyRound, Link2, PlugZap, Webhook } from "lucide-react";
import { api } from "../api";
import type { TrayStatus } from "../types";
import { WebhookManager } from "./WebhookManager";

export function TrayIntegration(props: { onConnected: () => Promise<void> }) {
  const [status, setStatus] = useState<TrayStatus | null>(null);
  const [apiAddress, setApiAddress] = useState("https://www.drossiinteriores.com.br/web_api");
  const [code, setCode] = useState("");
  const [storeHost, setStoreHost] = useState("https://www.drossiinteriores.com.br");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"connection" | "webhooks">("connection");

  async function loadStatus() {
    setStatus(await api.trayStatus());
  }

  useEffect(() => { void loadStatus(); }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await api.connectTray({ apiAddress, code, storeHost });
      setCode("");
      setMessage("Loja conectada e sincronização inicial concluída.");
      await loadStatus();
      await props.onConnected();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na integração.");
    } finally {
      setLoading(false);
    }
  }

  async function authorize() {
    setLoading(true);
    setMessage("");
    try {
      const result = await api.authorizationUrl(storeHost);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao abrir autorização.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("URL copiada.");
  }

  return (
    <section className="integration-page">
      <div className="integration-tabs" role="tablist" aria-label="Integração Tray">
        <button
          className={activeTab === "connection" ? "is-active" : ""}
          onClick={() => setActiveTab("connection")}
          role="tab"
          aria-selected={activeTab === "connection"}
        >
          <PlugZap size={17} /> Conexão e URLs
        </button>
        <button
          className={activeTab === "webhooks" ? "is-active" : ""}
          onClick={() => setActiveTab("webhooks")}
          role="tab"
          aria-selected={activeTab === "webhooks"}
        >
          <Webhook size={17} /> Webhooks
        </button>
      </div>

      {activeTab === "webhooks" ? (
        <WebhookManager />
      ) : (
        <section className="integration-layout">
          <article className="panel integration-card">
            <div className="panel__header">
              <div>
                <span className="eyebrow">CONEXÃO OFICIAL</span>
                <h2>Aplicativo Tray</h2>
              </div>
              <div className={`connection-badge ${status?.connected ? "connection-badge--ok" : ""}`}>
                {status?.connected ? <CheckCircle2 size={16} /> : <PlugZap size={16} />}
                {status?.connected ? "Conectado" : "Aguardando autorização"}
              </div>
            </div>

            {status?.connected && status.store ? (
              <div className="connection-details">
                <div><span>ID da loja</span><strong>{status.store.storeId}</strong></div>
                <div><span>API</span><strong>{status.store.apiAddress}</strong></div>
                <div><span>Último sync</span><strong>{status.store.lastSyncAt ? new Date(status.store.lastSyncAt).toLocaleString("pt-BR") : "Pendente"}</strong></div>
                <div><span>Token expira</span><strong>{new Date(status.store.tokenExpiresAt).toLocaleString("pt-BR")}</strong></div>
              </div>
            ) : (
              <form className="settings-form" onSubmit={connect}>
                <label>
                  <span>Domínio da loja</span>
                  <div className="input-with-icon"><Link2 size={18} /><input value={storeHost} onChange={(event) => setStoreHost(event.target.value)} /></div>
                </label>
                <label>
                  <span>api_address recebido pela Tray</span>
                  <div className="input-with-icon"><ExternalLink size={18} /><input value={apiAddress} onChange={(event) => setApiAddress(event.target.value)} required /></div>
                </label>
                <label>
                  <span>Código de autorização da loja</span>
                  <div className="input-with-icon"><KeyRound size={18} /><input type="password" value={code} onChange={(event) => setCode(event.target.value)} required /></div>
                </label>
                <div className="form-actions">
                  <button className="button button--primary" disabled={loading}>Conectar com código</button>
                  <button type="button" className="button button--secondary" onClick={authorize} disabled={loading}>Abrir autorização Tray</button>
                </div>
              </form>
            )}
            {message && <div className="form-message">{message}</div>}
          </article>

          <article className="panel endpoints-card">
            <span className="eyebrow">URLS DO APLICATIVO</span>
            <h2>Configuração na Tray</h2>
            <p>Use estas URLs no cadastro do aplicativo e no chamado de ativação do webhook.</p>
            {["callbackUrl", "authCallbackUrl", "webhookUrl"].map((field) => {
              const label = field === "callbackUrl" ? "Callback do aplicativo" : field === "authCallbackUrl" ? "Retorno da autorização" : "Notificação webhook";
              const value = status?.[field as keyof TrayStatus] as string | undefined;
              return (
                <div className="endpoint" key={field}>
                  <span>{label}</span>
                  <code>{value || "Carregando..."}</code>
                  <button className="icon-button" onClick={() => value && void copy(value)} disabled={!value}><Copy size={16} /></button>
                </div>
              );
            })}
          </article>
        </section>
      )}
    </section>
  );
}
