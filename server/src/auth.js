import jwt from "jsonwebtoken";
import { getUserById, getAdminById, fullName } from "./db.js";

export const JWT_SECRET = process.env.JWT_SECRET || "barangay-campagao-dev-secret";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function signToken(account) {
  return jwt.sign({ sub: account.id, role: account.role }, JWT_SECRET, { expiresIn: "12h" });
}

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role === "admin") {
      const admin = await getAdminById(payload.sub);
      if (!admin) return res.status(401).json({ error: "This account is no longer active. Please sign in again." });
      req.userId = payload.sub;
      req.userRole = "admin";
      return next();
    }

    const user = await getUserById(payload.sub);
    if (!user || user.status !== "Approved") {
      return res.status(401).json({ error: "This account is no longer active. Please sign in again." });
    }
    req.userId = payload.sub;
    req.userRole = user.role;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Not authorized for this action" });
    }
    next();
  };
}

// Approved accounts read as "Active" in the UI, downgrading on their own to "Inactive" once a
// full year passes with no login (falling back to the joined date if they've never logged in).
// Pending/Denied pass through unchanged — those are still admin-driven decisions.
export function computeDisplayStatus(user) {
  if (user.status !== "Approved") return user.status;
  const reference = user.lastLoginAt || user.joined;
  const referenceTime = reference ? new Date(reference).getTime() : NaN;
  if (Number.isNaN(referenceTime)) return "Active";
  return Date.now() - referenceTime > ONE_YEAR_MS ? "Inactive" : "Active";
}

export function toPublicUser(user) {
  const { passwordHash, tempPassword, ...rest } = user;
  return { ...rest, name: fullName(user), displayStatus: computeDisplayStatus(user) };
}

// Used only for the admin's single-user "View" detail — keeps tempPassword (never the hash)
// so staff/admin can look up a not-yet-changed temporary password if a resident/staff loses it.
export function toDetailedUser(user) {
  const { passwordHash, ...rest } = user;
  return { ...rest, name: fullName(user), displayStatus: computeDisplayStatus(user) };
}

export function toPublicAdmin(admin) {
  return { id: admin.id, email: admin.email, role: "admin", name: "Administrator" };
}
