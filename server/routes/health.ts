import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "volt-tray-dashboard", timestamp: new Date().toISOString() });
  })
);

export default router;
