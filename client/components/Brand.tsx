import { useState } from "react";

type BrandProps = { compact?: boolean };

export function Brand({ compact = false }: BrandProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      {!failed ? (
        <img src="/logo.png" alt="Logo da empresa" onError={() => setFailed(true)} />
      ) : (
        <>
          <div className="brand__fallback">D</div>
          {!compact && (
            <div className="brand__copy">
              <strong>Painel de pedidos</strong>
              <span>Integração Tray</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
