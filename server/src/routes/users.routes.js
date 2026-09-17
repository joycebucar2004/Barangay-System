import { Router } from "express";
import bcrypt from "bcryptjs";
import { listUsers, getUserByEmail, getUserById, createUser, setUserStatus } from "../db.js";
import { authRequired, requireRole, toPublicUser, toDetailedUser } from "../auth.js";
import { notifyUser, notifyRole } from "../notify.js";
import { sendCredentialsEmail } from "../mailer.js";

export const usersRouter = Router();

const VALID_GENDERS = ["Male", "Female", "Other"];
const VALID_CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated", "Divorced"];
const VALID_STATUSES = ["Pending", "Denied", "Approved"];

usersRouter.get("/", authRequired, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users: users.map(toPublicUser) });
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/", authRequired, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const { firstName, middleName, lastName, gender, civilStatus, dateOfBirth, email, password, role, address, contactNo } = req.body || {};
    if (!firstName || !lastName || !email || !password || !role || !gender || !civilStatus || !dateOfBirth) {
      return res.status(400).json({ error: "First name, last name, gender, civil status, date of birth, email, password and role are required" });
    }
    if (!["resident", "staff"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (req.userRole === "staff" && role !== "resident") {
      return res.status(403).json({ error: "Staff can only create resident accounts" });
    }
    if (!VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ error: "Invalid gender" });
    }
    if (!VALID_CIVIL_STATUSES.includes(civilStatus)) {
      return res.status(400).json({ error: "Invalid civil status" });
    }
    if (await getUserByEmail(email)) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const user = await createUser({
      firstName,
      middleName: middleName || "",
      lastName,
      gender,
      civilStatus,
      dateOfBirth,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      tempPassword: password,
      role,
      address: address || "",
      contactNo: contactNo || "",
      status: "Pending",
    });
    await notifyRole("admin", `New ${role} account for ${firstName} ${lastName} needs approval.`);

    res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

usersRouter.get("/:id", authRequired, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: toDetailedUser(user) });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch("/:id/status", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.status === "Approved") {
      return res.status(400).json({ error: "Active accounts can't be changed manually — they only go Inactive automatically after a year with no login." });
    }

    const { user: updated, tempPassword } = await setUserStatus(req.params.id, status);

    if (status === "Approved") {
      if (tempPassword) {
        sendCredentialsEmail({
          to: updated.email,
          name: `${updated.firstName} ${updated.lastName}`,
          email: updated.email,
          password: tempPassword,
        }).catch((err) => console.error("Failed to send credentials email:", err));
      }
      await notifyUser(updated.id, "Your account has been approved. Check your email for your login credentials.");
    } else if (status === "Denied") {
      await notifyUser(updated.id, "Your account registration was not approved. Please contact the barangay office.");
    }

    res.json({ user: toPublicUser(updated) });
  } catch (err) {
    next(err);
  }
});
