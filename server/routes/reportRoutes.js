import { Router } from "express";
import { getReport } from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);
router.use((req, res, next) => {
  const fields = req.path.replace(/\/+$/, "") === "/daily" ? ["date"] : [];
  if (Object.keys(req.query).some((key) => !fields.includes(key))) {
    return res.status(400).json({ success: false, message: "Unsupported query parameter" });
  }
  if (req.body !== undefined) {
    return res.status(400).json({ success: false, message: "A request body is not supported on this endpoint" });
  }
  next();
});

router.get("/daily", getReport);
router.get("/month-to-date", getReport);
router.get("/previous-month", getReport);

export default router;
