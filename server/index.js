import express from "express";
import cors from "cors";
import multer from "multer";
import { authRouter } from "./src/routes/auth.routes.js";
import { requestsRouter } from "./src/routes/requests.routes.js";
import { notificationsRouter } from "./src/routes/notifications.routes.js";
import { documentTypesRouter } from "./src/routes/documentTypes.routes.js";
import { usersRouter } from "./src/routes/users.routes.js";
import { reportsRouter } from "./src/routes/reports.routes.js";
import { announcementsRouter } from "./src/routes/announcements.routes.js";
import { UPLOAD_DIR } from "./src/upload.js";
import { ensureWalkInSchema } from "./src/db.js";

await ensureWalkInSchema();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api/auth", authRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/document-types", documentTypesRouter);
app.use("/api/users", usersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/announcements", announcementsRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === "Unsupported file type") {
    return res.status(400).json({ error: err.message || "File upload failed" });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
});

const server = app.listen(PORT, () => {
  console.log(`Barangay System API listening on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use — another instance of this server (or something else) is already running on it.\nStop that process first, or set a different PORT in server/.env.\n`);
    process.exit(1);
  }
  throw err;
});
