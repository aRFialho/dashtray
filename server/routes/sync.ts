import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { getDefaultStore } from "../services/dashboard";
import { syncMonth } from "../services/order-sync";
import { asyncHandler } from "../utils/async-handler";
import { currentMonth } from "../utils/date";
import { HttpError } from "../utils/http-error";

const router = Router();
const bodySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() });

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = bodySchema.parse(req.body ?? {});
    const store = await getDefaultStore();
    if (!store) throw new HttpError(409, "Nenhuma loja Tray conectada.");
    res.json(await syncMonth(store, input.month ?? currentMonth()));
  })
);

export default router;
