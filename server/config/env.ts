import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  SYNC_CRON: z.string().default("0 * * * *"),
  STATUS: z.string().trim().min(1, "Informe pelo menos um status de pedido monitorado."),
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

const trackedStatuses = Array.from(
  new Set(
    parsed.data.STATUS.split(",")
      .map((status) => status.trim().toUpperCase())
      .filter(Boolean)
  )
);

if (trackedStatuses.length === 0) {
  throw new Error("Informe pelo menos um status válido em STATUS.");
}

export const env = {
  ...parsed.data,
  APP_URL: parsed.data.APP_URL.replace(/\/$/, ""),
  trackedStatuses,
  trackedStatus: trackedStatuses.join(", "),
  allowedTrayHostnames: parsed.data.TRAY_ALLOWED_HOSTNAMES.split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)
};
