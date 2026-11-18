import { Router } from "express";
import { getUserData, Login, registerUser } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use((req, res, next) => {
  if (Object.keys(req.query).length) {
    return res.status(400).json({ success: false, message: "Query parameters are not supported on this endpoint" });
  }
  if (req.method === "GET" && req.body !== undefined) {
    return res.status(400).json({ success: false, message: "A request body is not supported on this endpoint" });
  }
  next();
});

router.route("/register").post(registerUser);
router.route("/login").post(Login);
router.get("/data", protect, getUserData);

export default router;
