import { Router } from "express";
import {
  listNotificationsForUser,
  listNotificationsForRole,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../db.js";
import { authRequired } from "../auth.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", authRequired, async (req, res, next) => {
  try {
    const notifications = req.userRole === "resident" ? await listNotificationsForUser(req.userId) : await listNotificationsForRole(req.userRole);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/read-all", authRequired, async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.userId, req.userRole);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/:id/read", authRequired, async (req, res, next) => {
  try {
    const notification = await markNotificationRead(req.params.id);
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete("/:id", authRequired, async (req, res, next) => {
  try {
    const deleted = await deleteNotification(req.params.id, req.userId, req.userRole);
    if (!deleted) return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete("/", authRequired, async (req, res, next) => {
  try {
    await deleteAllNotifications(req.userId, req.userRole);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
