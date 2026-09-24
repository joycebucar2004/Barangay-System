import { Router } from "express";
import { listAnnouncements, getAnnouncementById, createAnnouncement, updateAnnouncement, deleteAnnouncement } from "../db.js";
import { authRequired, requireRole } from "../auth.js";
import { imageUpload, removeUpload } from "../upload.js";

export const announcementsRouter = Router();

const VALID_TAGS = ["Advisory", "Announcement", "Event", "Notice"];

announcementsRouter.get("/", async (req, res, next) => {
  try {
    res.json({ announcements: await listAnnouncements() });
  } catch (err) {
    next(err);
  }
});

// Accepts JSON or multipart (with an optional "image" file).
announcementsRouter.post("/", authRequired, requireRole("admin"), imageUpload.single("image"), async (req, res, next) => {
  try {
    const { tag, title, body, date } = req.body || {};
    if (!tag || !title || !body) {
      if (req.file) removeUpload(req.file.filename);
      return res.status(400).json({ error: "Tag, title and body are required" });
    }
    if (!VALID_TAGS.includes(tag)) {
      if (req.file) removeUpload(req.file.filename);
      return res.status(400).json({ error: `Tag must be one of: ${VALID_TAGS.join(", ")}` });
    }
    const announcement = await createAnnouncement({
      tag,
      title,
      body,
      date: date || new Date().toISOString().split("T")[0],
      image: req.file ? req.file.filename : null,
    });
    res.status(201).json({ announcement });
  } catch (err) {
    next(err);
  }
});

// A new "image" file replaces the old one; removeImage=true clears it.
announcementsRouter.put("/:id", authRequired, requireRole("admin"), imageUpload.single("image"), async (req, res, next) => {
  try {
    const { tag, title, body, date, removeImage } = req.body || {};
    if (tag && !VALID_TAGS.includes(tag)) {
      if (req.file) removeUpload(req.file.filename);
      return res.status(400).json({ error: `Tag must be one of: ${VALID_TAGS.join(", ")}` });
    }
    const existing = await getAnnouncementById(req.params.id);
    if (!existing) {
      if (req.file) removeUpload(req.file.filename);
      return res.status(404).json({ error: "Announcement not found" });
    }

    const fields = { tag, title, body, date };
    if (req.file) fields.image = req.file.filename;
    else if (removeImage === "true" || removeImage === true) fields.image = null;

    const announcement = await updateAnnouncement(req.params.id, fields);
    if (fields.image !== undefined && existing.image) removeUpload(existing.image);
    res.json({ announcement });
  } catch (err) {
    next(err);
  }
});

announcementsRouter.delete("/:id", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const existing = await getAnnouncementById(req.params.id);
    const ok = await deleteAnnouncement(req.params.id);
    if (!ok) return res.status(404).json({ error: "Announcement not found" });
    if (existing?.image) removeUpload(existing.image);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
