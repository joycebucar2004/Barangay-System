import { Router } from "express";
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserById, createUser, updateUserProfile, updateUserPasswordHash, updateUserLastLogin, getAdminByEmail, getAdminById } from "../db.js";
import { authRequired, signToken, toPublicUser, toPublicAdmin } from "../auth.js";
import { generateTempPassword } from "../passwordGen.js";
import { notifyRole } from "../notify.js";

export const authRouter = Router();

const VALID_GENDERS = ["Male", "Female", "Other"];
const VALID_CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated", "Divorced"];

const STATUS_MESSAGES = {
  Pending: "Your account is awaiting admin approval. You'll receive an email once it's reviewed.",
  Denied: "Your account registration was not approved. Please contact the barangay office.",
};

authRouter.post("/register", async (req, res, next) => {
  try {
    const { firstName, middleName, lastName, gender, civilStatus, dateOfBirth, email, address, contactNo } = req.body || {};
    if (!firstName || !lastName || !email || !gender || !civilStatus || !dateOfBirth) {
      return res.status(400).json({ error: "First name, last name, gender, civil status, date of birth and email are required" });
    }
    if (!VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ error: "Invalid gender" });
    }
    if (!VALID_CIVIL_STATUSES.includes(civilStatus)) {
      return res.status(400).json({ error: "Invalid civil status" });
    }
    const exists = await getUserByEmail(email);
    if (exists) return res.status(409).json({ error: "An account with this email already exists" });

    const tempPassword = generateTempPassword({ firstName, lastName, dateOfBirth });
    const user = await createUser({
      firstName,
      middleName: middleName || "",
      lastName,
      gender,
      civilStatus,
      dateOfBirth,
      email,
      passwordHash: bcrypt.hashSync(tempPassword, 10),
      tempPassword,
      role: "resident",
      address: address || "",
      contactNo: contactNo || "",
      status: "Pending",
    });
    await notifyRole("admin", `New resident registration from ${firstName} ${lastName} needs approval.`);

    res.status(201).json({ pending: true, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    if (role === "admin") {
      const admin = await getAdminByEmail(email);
      if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const token = signToken({ id: admin.id, role: "admin" });
      return res.json({ token, user: toPublicAdmin(admin) });
    }

    const user = await getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (role && user.role !== role) {
      return res.status(401).json({ error: `This account is registered as ${user.role}. Please select the correct role tab.` });
    }
    if (user.status !== "Approved") {
      return res.status(403).json({ error: STATUS_MESSAGES[user.status] || "This account is not active." });
    }

    await updateUserLastLogin(user.id);
    const token = signToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authRequired, async (req, res, next) => {
  try {
    if (req.userRole === "admin") {
      const admin = await getAdminById(req.userId);
      if (!admin) return res.status(404).json({ error: "Admin not found" });
      return res.json({ user: toPublicAdmin(admin) });
    }
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/me", authRequired, async (req, res, next) => {
  try {
    if (req.userRole === "admin") return res.status(400).json({ error: "Admin accounts have no editable profile" });
    const { firstName, middleName, lastName, gender, civilStatus, dateOfBirth, email, address, contactNo } = req.body || {};
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (gender && !VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ error: "Invalid gender" });
    }
    if (civilStatus && !VALID_CIVIL_STATUSES.includes(civilStatus)) {
      return res.status(400).json({ error: "Invalid civil status" });
    }
    const fields = {};
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const exists = await getUserByEmail(email);
      if (exists && exists.id !== user.id) return res.status(409).json({ error: "An account with this email already exists" });
      fields.email = email;
    }
    if (firstName) fields.firstName = firstName;
    if (middleName !== undefined) fields.middleName = middleName;
    if (lastName) fields.lastName = lastName;
    if (gender) fields.gender = gender;
    if (civilStatus) fields.civilStatus = civilStatus;
    if (dateOfBirth) fields.dateOfBirth = dateOfBirth;
    if (address !== undefined) fields.address = address;
    if (contactNo !== undefined) fields.contactNo = contactNo;

    const updated = await updateUserProfile(req.userId, fields);
    res.json({ user: toPublicUser(updated) });
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/me/password", authRequired, async (req, res, next) => {
  try {
    if (req.userRole === "admin") return res.status(400).json({ error: "Admin password changes are not supported here" });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    await updateUserPasswordHash(req.userId, bcrypt.hashSync(newPassword, 10));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
