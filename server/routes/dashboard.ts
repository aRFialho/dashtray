import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { buildDashboardData } from "../services/dashboard";
import { asyncHandler } from "../utils/async-handler";
import { currentMonth } from "../utils/date";

const router = Router();
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

router.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const month = req.query.month ? monthSchema.parse(req.query.month) : currentMonth();
    res.json(await buildDashboardData(month));
  })
);

export default router;
