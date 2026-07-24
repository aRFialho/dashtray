import path from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import authRouter from "./routes/auth";
import dashboardRouter from "./routes/dashboard";
import goalsRouter from "./routes/goals";
import healthRouter from "./routes/health";
import syncRouter from "./routes/sync";
import { apiRouter as trayApiRouter, publicRouter as trayPublicRouter } from "./routes/tray";
import { HttpError } from "./utils/http-error";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  const securityHeaders = (allowTrayFrame: boolean) =>
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: allowTrayFrame ? ["'self'", "https:"] : ["'none'"]
        }
      },
      crossOriginResourcePolicy: { policy: "same-origin" },
      frameguard: false
    });

  const defaultSecurityHeaders = securityHeaders(false);
  const traySecurityHeaders = securityHeaders(true);
  app.use((req, res, next) => {
    const middleware = req.path === "/tray" || req.path.startsWith("/tray/")
      ? traySecurityHeaders
      : defaultSecurityHeaders;
    middleware(req, res, next);
  });
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/goals", goalsRouter);
  app.use("/api/sync", syncRouter);
  app.use("/api/tray", trayApiRouter);
  app.use("/tray", trayPublicRouter);

  const clientDir = path.resolve(process.cwd(), "dist/client");
  app.use(express.static(clientDir, { index: false, maxAge: "1h" }));

  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/health") || req.path.startsWith("/tray/")) return next();
    if (!req.accepts("html")) return next();
    res.sendFile(path.join(clientDir, "index.html"));
  });

  app.use((_req, _res, next) => next(new HttpError(404, "Rota não encontrada.")));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Dados inválidos.",
        fields: error.flatten().fieldErrors
      });
    }

    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message, details: error.details });
    }

    console.error(error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Erro interno do servidor." : message
    });
  });

  return app;
}
