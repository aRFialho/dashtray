import http from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./db";
import { configureRealtime } from "./services/realtime";
import { startScheduler } from "./services/scheduler";

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  const app = createApp();
  const server = http.createServer(app);
  configureRealtime(server);
  startScheduler();

  server.listen(env.PORT, "0.0.0.0", () => {
    console.log(`Volt Tray Dashboard ativo na porta ${env.PORT}.`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Recebido ${signal}. Encerrando...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch(async (error) => {
  console.error("Falha ao iniciar a aplicação:", error);
  await prisma.$disconnect();
  process.exit(1);
});
