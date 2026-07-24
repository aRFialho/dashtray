import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { requireAdmin } from "../middleware/auth";
import { getDefaultStore } from "../services/dashboard";
import { syncMonth, syncToday } from "../services/order-sync";
import { asyncHandler } from "../utils/async-handler";
import { currentMonth, isAutomaticSyncWindow } from "../utils/date";
import { HttpError } from "../utils/http-error";

const router = Router();
const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  automatic: z.boolean().optional().default(false)
});

router.post(
  "/live",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = bodySchema.parse(req.body ?? {});
    const store = await getDefaultStore();
    if (!store) throw new HttpError(409, "Nenhuma loja Tray conectada.");

    if (input.automatic && !isAutomaticSyncWindow(env.APP_TIMEZONE)) {
      return res.json({ skipped: true, reason: "outside-business-window" });
    }

    const requestedMonth = input.month ?? currentMonth(env.APP_TIMEZONE);
    if (requestedMonth !== currentMonth(env.APP_TIMEZONE)) {
      throw new HttpError(400, "A sincronização rápida consulta somente os pedidos de hoje do mês atual.");
    }

    const result = await syncToday(store, {
      broadcast: "count-only",
      source: "browser",
      reason: input.automatic ? "browser" : "manual"
    });
    console.log(
      `[sync:browser:today] loja ${store.storeId} · páginas ${result.pages} · itens ${result.items} · total ${result.liveUpdate.orders} · variação ${result.liveUpdate.delta >= 0 ? "+" : ""}${result.liveUpdate.delta}`
    );
    return res.json({ skipped: false, update: result.liveUpdate });
  })
);

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = bodySchema.parse(req.body ?? {});
    const store = await getDefaultStore();
    if (!store) throw new HttpError(409, "Nenhuma loja Tray conectada.");
    res.json(await syncMonth(store, input.month ?? currentMonth(env.APP_TIMEZONE), {
      scope: "month",
      reason: "manual"
    }));
  })
);

export default router;
