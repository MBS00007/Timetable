const path = require("node:path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const pool = require("./db/pool");
const apiRouter = require("./routes/api");

dotenv.config();
const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", async (request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ ok: true, service: "Northwest University timetable API" });
  } catch (error) {
    response.status(503).json({ ok: false, error: "Database unavailable" });
  }
});
app.use("/api", apiRouter);
app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
});
app.use((request, response) =>
  response.status(404).json({ error: "Route not found" }),
);

app.listen(port, () =>
  console.log(`Backend API running at http://localhost:${port}`),
);
