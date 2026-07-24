import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env";
import { requireAdmin, SESSION_COOKIE, signSession } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { HttpError } from "../utils/http-error";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
});

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const emailMatches = input.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();

    let passwordMatches = false;
    if (env.ADMIN_PASSWORD_HASH) {
      passwordMatches = await bcrypt.compare(input.password, env.ADMIN_PASSWORD_HASH);
    } else if (env.ADMIN_PASSWORD) {
      passwordMatches = input.password === env.ADMIN_PASSWORD;
    }

    if (!emailMatches || !passwordMatches) {
      throw new HttpError(401, "E-mail ou senha inválidos.");
    }

    const token = signSession({ email: env.ADMIN_EMAIL, role: "admin" });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
      path: "/"
    });

    res.json({ user: { email: env.ADMIN_EMAIL } });
  })
);

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ user: req.admin });
});

export default router;
