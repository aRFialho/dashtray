import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  SYNC_CRON: z.string().default("0 * * * *"),
  STATUS: z.string().trim().default("*"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  TRAY_CONSUMER_KEY: z.string().default(""),
  TRAY_CONSUMER_SECRET: z.string().default(""),
  TRAY_WEBHOOK_TOKEN: z.string().default(""),
  TRAY_ALLOWED_HOSTNAMES: z.string().default("www.drossiinteriores.com.br,drossiinteriores.com.br,*.commercesuite.com.br,*.tray.com.br"),
  ADMIN_EMAIL: z.string().email().default("admin@empresa.com.br"),
  ADMIN_PASSWORD_HASH: z.string().default(""),
  ADMIN_PASSWORD: z.string().default(""),
  JWT_SECRET: z.string().min(24),
  TOKEN_ENCRYPTION_KEY: z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", parsed.error.flatten().fieldErrors);
  throw new Error("Configuração de ambiente inválida.");
}

const rawStatus = parsed.data.STATUS.trim();
const trackAllStatuses = ["", "*", "ALL", "TODOS", "TODOS OS STATUS", "TODOS OS STATUSES"].includes(
  rawStatus.toUpperCase()
);

const trackedStatuses = trackAllStatuses
  ? []
  : Array.from(
      new Set(
        rawStatus
          .split(",")
          .map((status) => status.trim().toUpperCase())
          .filter(Boolean)
      )
    );

if (!trackAllStatuses && trackedStatuses.length === 0) {
  throw new Error("Informe STATUS=* para todos os pedidos ou uma lista de status separada por vírgula.");
}

export const env = {
  ...parsed.data,
  APP_URL: parsed.data.APP_URL.replace(/\/$/, ""),
  trackAllStatuses,
  trackedStatuses,
  trackedStatus: trackAllStatuses ? "TODOS OS STATUS" : trackedStatuses.join(", "),
  allowedTrayHostnames: parsed.data.TRAY_ALLOWED_HOSTNAMES.split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)
};
