import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import routeRouter from "./routes/routeRouter";
import departureRouter from "./routes/departureRouter";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/route", routeRouter);
app.use("/api/departure-time", departureRouter);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`SmartTime AI backend running on http://localhost:${PORT}`);
});
