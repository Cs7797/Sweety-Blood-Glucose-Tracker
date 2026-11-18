import { Router } from "express";
import { addReading, deleteReading, getReadings, updateReading } from "../controllers/readingController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);
router.use((req, res, next) => {
  const fields = req.method === "GET" && req.path === "/" ? ["date"] : [];
  if (Object.keys(req.query).some((key) => !fields.includes(key))) {
    return res.status(400).json({ success: false, message: "Unsupported query parameter" });
  }
  if (["GET", "DELETE"].includes(req.method) && req.body !== undefined) {
    return res.status(400).json({ success: false, message: "A request body is not supported on this endpoint" });
  }
  next();
});

router.param("id", (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
    return res.status(400).json({ success: false, message: "Reading ID must be a valid positive integer" });
  }
  next();
});

router.route("/").get(getReadings).post(addReading);
router.route("/:id").put(updateReading).delete(deleteReading);

export default router;
