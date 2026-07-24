import { FormEvent, useState } from "react";
import { LockKeyhole, Mail, Radar } from "lucide-react";
import { Brand } from "./Brand";

export function LoginPage(props: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await props.onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-page__grid" />
      <section className="login-card">
        <Brand />
        <div className="login-card__hero">
          <Radar size={32} />
          <span>PAINEL OPERACIONAL</span>
          <h1>Pedidos em movimento.</h1>
          <p>Acompanhe a meta mensal, o ritmo diário e cada novo pedido recebido pela Tray.</p>
        </div>

        <form onSubmit={submit} className="login-form">
          <label>
            <span>E-mail administrativo</span>
            <div className="input-with-icon">
              <Mail size={18} />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
            </div>
          </label>
          <label>
            <span>Senha</span>
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
            </div>
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="button button--primary button--large" type="submit" disabled={loading}>
            {loading ? "Autenticando..." : "Entrar no dashboard"}
          </button>
        </form>
      </section>
    </main>
  );
}
