import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin } from "../middleware/auth";
import { buildDashboardData, getDefaultStore } from "../services/dashboard";
import { emitDashboardUpdate } from "../services/realtime";
import { asyncHandler } from "../utils/async-handler";
import { HttpError } from "../utils/http-error";
import { parseMonthKey } from "../utils/date";

const router = Router();
const bodySchema = z.object({ targetOrders: z.coerce.number().int().min(0).max(10_000_000) });

router.put(
  "/:month",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.params.month);
    const parts = parseMonthKey(month);
    const input = bodySchema.parse(req.body);
    const store = await getDefaultStore();
    if (!store) throw new HttpError(409, "Conecte uma loja Tray antes de definir a meta.");

    const goal = await prisma.goal.upsert({
      where: {
        storeRecordId_year_month: {
          storeRecordId: store.id,
          year: parts.year,
          month: parts.month
        }
      },
      create: {
        storeRecordId: store.id,
        year: parts.year,
        month: parts.month,
        targetOrders: input.targetOrders,
        createdBy: req.admin?.email
      },
      update: {
        targetOrders: input.targetOrders,
        createdBy: req.admin?.email
      }
    });

    const dashboard = await buildDashboardData(month, store.id);
    emitDashboardUpdate(dashboard);
    res.json({ goal, dashboard });
  })
);

export default router;
