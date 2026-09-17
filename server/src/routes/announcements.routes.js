import { Router } from "express";
import { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

export const announcementsRouter = Router();

const VALID_TAGS = ["Advisory", "Announcement", "Event", "Notice"];

announcementsRouter.get("/", async (req, res, next) => {
  try {
    res.json({ announcements: await listAnnouncements() });
  } catch (err) {
    next(err);
  }
});

announcementsRouter.post("/", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const { tag, title, body, date } = req.body || {};
    if (!tag || !title || !body) {
      return res.status(400).json({ error: "Tag, title and body are required" });
    }
    if (!VALID_TAGS.includes(tag)) {
      return res.status(400).json({ error: `Tag must be one of: ${VALID_TAGS.join(", ")}` });
    }
    const announcement = await createAnnouncement({ tag, title, body, date: date || new Date().toISOString().split("T")[0] });
    res.status(201).json({ announcement });
  } catch (err) {
    next(err);
  }
});

announcementsRouter.put("/:id", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const { tag, title, body, date } = req.body || {};
    if (tag && !VALID_TAGS.includes(tag)) {
      return res.status(400).json({ error: `Tag must be one of: ${VALID_TAGS.join(", ")}` });
    }
    const existing = await listAnnouncements();
    if (!existing.some((a) => a.id === req.params.id)) return res.status(404).json({ error: "Announcement not found" });

    const announcement = await updateAnnouncement(req.params.id, { tag, title, body, date });
    res.json({ announcement });
  } catch (err) {
    next(err);
  }
});

announcementsRouter.delete("/:id", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const ok = await deleteAnnouncement(req.params.id);
    if (!ok) return res.status(404).json({ error: "Announcement not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
