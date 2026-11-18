import express from "express";
import cors from "cors";
import { clientUrl } from "./config/env.js";
import router from "./routes/userRoutes.js";
import errorHandler from "./middleware/error.js";

const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: "10kb" }));
app.use("/api/user", router);
app.use((req, res) => {
  return res.status(404).json({ success: false, message: "Endpoint not found" });
});
app.use(errorHandler);

export default app;
