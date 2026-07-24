import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

export const SESSION_COOKIE = "volt_session";

export type SessionPayload = {
  email: string;
  role: "admin";
};

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "12h",
    issuer: "volt-tray-dashboard"
  });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "volt-tray-dashboard"
  }) as SessionPayload;
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return next(new HttpError(401, "Sessão não autenticada."));

  try {
    const payload = verifySession(token);
    req.admin = { email: payload.email };
    next();
  } catch {
    next(new HttpError(401, "Sessão expirada ou inválida."));
  }
}
