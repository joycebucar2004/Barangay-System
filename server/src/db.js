import { pool } from "./mysql.js";

export function fullName(user) {
  const middleInitial = user.middleName ? `${user.middleName.trim()[0]}.` : "";
  return [user.firstName, middleInitial, user.lastName].filter(Boolean).join(" ");
}

// ============================================================
// Row <-> API shape mapping (DB is snake_case, API is camelCase)
// ============================================================

// Residents live in `users`, staff in their own `staff` table (see db/schema.sql) -- neither
// table has a role column, since the table itself says what the account is. `role` is stamped
// on here based on which table the row came from.
function mapUser(row, role) {
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    gender: row.gender,
    civilStatus: row.civil_status,
    dateOfBirth: row.date_of_birth,
    email: row.email,
    passwordHash: row.password_hash,
    tempPassword: row.temp_password,
    role,
    address: row.address,
    contactNo: row.contact_no,
    status: row.status,
    joined: row.joined,
    lastLoginAt: row.last_login_at,
  };
}

// Resident and staff ids are role-prefixed (R-ID-/S-ID-, see nextId() below), so which table an
// id belongs to can be told apart without a lookup.
function isStaffId(id) {
  return typeof id === "string" && id.startsWith("S-ID-");
}

function mapAdmin(row) {
  if (!row) return null;
  return { id: String(row.id), email: row.email, passwordHash: row.password_hash };
}

function mapRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    docType: row.doc_type,
    status: row.status,
    purpose: row.purpose,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    fee: Number(row.fee),
    paid: !!row.paid,
    printedAt: row.printed_at,
    address: row.address,
    contactNo: row.contact_no,
    dateOfBirth: row.date_of_birth,
    civilStatus: row.civil_status,
    remarks: row.remarks || undefined,
    files: [],
  };
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    forRole: row.for_role,
    message: row.message,
    time: new Date(row.time).toISOString(),
    read: !!row.is_read,
  };
}

function mapAnnouncement(row) {
  if (!row) return null;
  return { id: row.id, tag: row.tag, title: row.title, body: row.body, date: row.date };
}

async function nextId(counterName, prefix, pad = 0) {
  await pool.query("UPDATE counters SET value = value + 1 WHERE name = ?", [counterName]);
  const [[row]] = await pool.query("SELECT value FROM counters WHERE name = ?", [counterName]);
  const n = pad ? String(row.value).padStart(pad, "0") : row.value;
  return `${prefix}${n}`;
}

// ============================================================
// Users
// ============================================================

export async function getUserByEmail(email) {
  const [residentRows] = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [email]);
  if (residentRows[0]) return mapUser(residentRows[0], "resident");
  const [staffRows] = await pool.query("SELECT * FROM staff WHERE LOWER(email) = LOWER(?) LIMIT 1", [email]);
  return mapUser(staffRows[0], "staff");
}

export async function getUserById(id) {
  const table = isStaffId(id) ? "staff" : "users";
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [id]);
  return mapUser(rows[0], isStaffId(id) ? "staff" : "resident");
}

export async function listUsers() {
  const [residentRows] = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
  const [staffRows] = await pool.query("SELECT * FROM staff ORDER BY created_at DESC");
  const users = [...residentRows.map((r) => mapUser(r, "resident")), ...staffRows.map((r) => mapUser(r, "staff"))];
  users.sort((a, b) => (b.joined || "").localeCompare(a.joined || ""));
  return users;
}

export async function createUser({ firstName, middleName, lastName, gender, civilStatus, dateOfBirth, email, passwordHash, tempPassword, role, address, contactNo, status }) {
  const table = role === "staff" ? "staff" : "users";
  const id = role === "staff" ? await nextId("staff", "S-ID-", 3) : await nextId("resident", "R-ID-", 3);
  const joined = new Date().toISOString().split("T")[0];
  await pool.query(
    `INSERT INTO ${table} (id, first_name, middle_name, last_name, gender, civil_status, date_of_birth, email, password_hash, temp_password, address, contact_no, status, joined)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, firstName, middleName || "", lastName, gender, civilStatus, dateOfBirth, email, passwordHash, tempPassword || null, address || "", contactNo || "", status, joined]
  );
  return getUserById(id);
}

export async function updateUserProfile(id, fields) {
  const table = isStaffId(id) ? "staff" : "users";
  const columns = { firstName: "first_name", middleName: "middle_name", lastName: "last_name", gender: "gender", civilStatus: "civil_status", dateOfBirth: "date_of_birth", email: "email", address: "address", contactNo: "contact_no" };
  const sets = [];
  const values = [];
  for (const [key, col] of Object.entries(columns)) {
    if (fields[key] !== undefined) {
      sets.push(`${col} = ?`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return getUserById(id);
  values.push(id);
  await pool.query(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, values);
  return getUserById(id);
}

// temp_password is intentionally never cleared here: it's the permanent record of what was
// emailed to the user on approval, kept for staff/admin reference via the user detail view for
// the lifetime of the account, even after the user changes their password.
export async function updateUserPasswordHash(id, passwordHash) {
  const table = isStaffId(id) ? "staff" : "users";
  await pool.query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
}

export async function updateUserLastLogin(id) {
  const table = isStaffId(id) ? "staff" : "users";
  await pool.query(`UPDATE ${table} SET last_login_at = NOW() WHERE id = ?`, [id]);
}

export async function setUserStatus(id, status) {
  const table = isStaffId(id) ? "staff" : "users";
  const user = await getUserById(id);
  if (!user) return null;
  await pool.query(`UPDATE ${table} SET status = ? WHERE id = ?`, [status, id]);
  return { user: await getUserById(id), tempPassword: user.tempPassword };
}

// ============================================================
// Admins (fully separate from users — no profile, no approval workflow)
// ============================================================

export async function getAdminByEmail(email) {
  const [results] = await pool.query("CALL sp_get_admin_by_email(?)", [email]);
  return mapAdmin(results[0][0]);
}

export async function getAdminById(id) {
  const [results] = await pool.query("CALL sp_get_admin_by_id(?)", [id]);
  return mapAdmin(results[0][0]);
}

// ============================================================
// Document types
// ============================================================

export async function listDocumentTypes() {
  const [types] = await pool.query("SELECT name, fee FROM document_types ORDER BY name");
  const [reqs] = await pool.query("SELECT document_type_name, requirement, required FROM document_type_requirements ORDER BY document_type_name, sort_order");
  const byName = {};
  for (const r of reqs) {
    (byName[r.document_type_name] ||= []).push({ requirement: r.requirement, required: !!r.required });
  }
  return types.map((t) => ({ name: t.name, fee: Number(t.fee), requirements: byName[t.name] || [] }));
}

export async function addDocumentType(name, fee) {
  const [existing] = await pool.query("SELECT 1 FROM document_types WHERE name = ?", [name]);
  if (existing.length > 0) throw Object.assign(new Error("Document type already exists"), { status: 409 });
  await pool.query("INSERT INTO document_types (name, fee) VALUES (?, ?)", [name, fee]);
}

export async function addDocumentTypeRequirement(name, requirement, sortOrder, required = true) {
  await pool.query("INSERT INTO document_type_requirements (document_type_name, requirement, required, sort_order) VALUES (?, ?, ?, ?)", [name, requirement, required ? 1 : 0, sortOrder]);
}

export async function updateDocumentTypeFee(name, fee) {
  await pool.query("UPDATE document_types SET fee = ? WHERE name = ?", [fee, name]);
}

// requirements: [{ requirement: string, required: boolean }]
export async function replaceDocumentTypeRequirements(name, requirements) {
  await pool.query("DELETE FROM document_type_requirements WHERE document_type_name = ?", [name]);
  for (let i = 0; i < requirements.length; i++) {
    await addDocumentTypeRequirement(name, requirements[i].requirement, i + 1, requirements[i].required);
  }
}

// ============================================================
// Requests
// ============================================================

async function attachFiles(requests) {
  if (requests.length === 0) return requests;
  const ids = requests.map((r) => r.id);
  const [files] = await pool.query(`SELECT request_id, original_name, requirement, stored_name FROM request_files WHERE request_id IN (${ids.map(() => "?").join(",")})`, ids);
  const byRequest = {};
  for (const f of files) {
    (byRequest[f.request_id] ||= []).push({ originalName: f.original_name, storedName: f.stored_name, requirement: f.requirement || undefined });
  }
  for (const r of requests) r.files = byRequest[r.id] || [];
  return requests;
}

export async function createRequest({ residentId, residentName, docType, purpose, fee, paid, address, contactNo, dateOfBirth, civilStatus }) {
  const year = new Date().getFullYear();
  await pool.query("UPDATE counters SET value = value + 1 WHERE name = 'request'");
  const [[row]] = await pool.query("SELECT value FROM counters WHERE name = 'request'");
  const id = `BR-${year}-${String(row.value).padStart(3, "0")}`;
  const today = new Date().toISOString().split("T")[0];

  await pool.query(
    `INSERT INTO requests (id, resident_id, doc_type, status, purpose, submitted_at, updated_at, fee, paid, address, contact_no, date_of_birth, civil_status)
     VALUES (?,?,?,'Pending',?,?,?,?,?,?,?,?,?)`,
    [id, residentId, docType, purpose, today, today, fee, paid ? 1 : 0, address || "", contactNo || "", dateOfBirth || null, civilStatus || null]
  );
  const request = await getRequestById(id);
  request.residentName = residentName;
  return request;
}

export async function addRequestFiles(requestId, files) {
  for (const f of files) {
    await pool.query("INSERT INTO request_files (request_id, original_name, requirement, stored_name) VALUES (?, ?, ?, ?)", [requestId, f.originalName, f.requirement || null, f.storedName]);
  }
}

// Used when a resident fixes a rejected request: swaps out whatever file was previously
// attached for this requirement (if any) so there's never more than one current file per
// requirement — the old upload is superseded, not kept alongside the corrected one.
export async function replaceRequestFile(requestId, requirement, file) {
  await pool.query("DELETE FROM request_files WHERE request_id = ? AND requirement = ?", [requestId, requirement]);
  await pool.query("INSERT INTO request_files (request_id, original_name, requirement, stored_name) VALUES (?, ?, ?, ?)", [requestId, file.originalName, requirement, file.storedName]);
}

async function requestsWithResidentName(whereSql, params) {
  const [rows] = await pool.query(
    `SELECT r.*, CONCAT(u.first_name, IF(u.middle_name <> '', CONCAT(' ', LEFT(u.middle_name,1), '.'), ''), ' ', u.last_name) AS resident_name
     FROM requests r JOIN users u ON u.id = r.resident_id
     ${whereSql} ORDER BY r.submitted_at DESC`,
    params
  );
  return attachFiles(rows.map(mapRequest));
}

export async function listRequestsForResident(residentId) {
  return requestsWithResidentName("WHERE r.resident_id = ?", [residentId]);
}

export async function listAllRequests() {
  return requestsWithResidentName("", []);
}

export async function getRequestById(id) {
  const [requests] = await requestsWithResidentName("WHERE r.id = ?", [id]);
  return requests || null;
}

export async function updateRequestStatus(id, { status, remarks, paid }) {
  const today = new Date().toISOString().split("T")[0];
  const sets = ["status = ?", "updated_at = ?"];
  const values = [status, today];
  if (remarks !== undefined) {
    sets.push("remarks = ?");
    values.push(remarks);
  }
  if (paid !== undefined) {
    sets.push("paid = ?");
    values.push(paid ? 1 : 0);
  }
  values.push(id);
  await pool.query(`UPDATE requests SET ${sets.join(", ")} WHERE id = ?`, values);
  return getRequestById(id);
}

export async function markRequestPaid(id) {
  await pool.query("UPDATE requests SET paid = 1 WHERE id = ?", [id]);
  return getRequestById(id);
}

export async function markRequestPrinted(id) {
  await pool.query("UPDATE requests SET printed_at = NOW() WHERE id = ?", [id]);
  return getRequestById(id);
}

// ============================================================
// Notifications
// ============================================================

export async function notifyUser(userId, message) {
  const id = await nextId("notification", "n");
  await pool.query("INSERT INTO notifications (id, user_id, for_role, message, time, is_read) VALUES (?, ?, NULL, ?, NOW(), 0)", [id, userId, message]);
  return id;
}

export async function notifyRole(role, message) {
  const id = await nextId("notification", "n");
  await pool.query("INSERT INTO notifications (id, user_id, for_role, message, time, is_read) VALUES (?, NULL, ?, ?, NOW(), 0)", [id, role, message]);
  return id;
}

export async function listNotificationsForUser(userId) {
  const [rows] = await pool.query("SELECT * FROM notifications WHERE user_id = ? ORDER BY time DESC", [userId]);
  return rows.map(mapNotification);
}

export async function listNotificationsForRole(role) {
  const [rows] = await pool.query("SELECT * FROM notifications WHERE for_role = ? ORDER BY time DESC", [role]);
  return rows.map(mapNotification);
}

export async function getNotificationById(id) {
  const [rows] = await pool.query("SELECT * FROM notifications WHERE id = ?", [id]);
  return mapNotification(rows[0]);
}

export async function markNotificationRead(id) {
  await pool.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
  return getNotificationById(id);
}

export async function markAllNotificationsRead(userId, role) {
  if (role === "resident") {
    await pool.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId]);
  } else {
    await pool.query("UPDATE notifications SET is_read = 1 WHERE for_role = ?", [role]);
  }
}

// Role-broadcast notifications (for_role set, user_id NULL) are shared by every staff/admin --
// deleting one removes it for the whole role, same as marking it read already does.
export async function deleteNotification(id, userId, role) {
  const notification = await getNotificationById(id);
  if (!notification) return false;
  const owned = role === "resident" ? notification.userId === userId : notification.forRole === role;
  if (!owned) return false;
  await pool.query("DELETE FROM notifications WHERE id = ?", [id]);
  return true;
}

export async function deleteAllNotifications(userId, role) {
  if (role === "resident") {
    await pool.query("DELETE FROM notifications WHERE user_id = ?", [userId]);
  } else {
    await pool.query("DELETE FROM notifications WHERE for_role = ?", [role]);
  }
}

// ============================================================
// Announcements
// ============================================================

export async function listAnnouncements() {
  const [rows] = await pool.query("SELECT * FROM announcements ORDER BY date DESC, id DESC");
  return rows.map(mapAnnouncement);
}

export async function getAnnouncementById(id) {
  const [rows] = await pool.query("SELECT * FROM announcements WHERE id = ?", [id]);
  return mapAnnouncement(rows[0]);
}

export async function createAnnouncement({ tag, title, body, date }) {
  const id = await nextId("announcement", "a");
  await pool.query("INSERT INTO announcements (id, tag, title, body, date) VALUES (?,?,?,?,?)", [id, tag, title, body, date]);
  return getAnnouncementById(id);
}

export async function updateAnnouncement(id, fields) {
  const columns = { tag: "tag", title: "title", body: "body", date: "date" };
  const sets = [];
  const values = [];
  for (const [key, col] of Object.entries(columns)) {
    if (fields[key] !== undefined) {
      sets.push(`${col} = ?`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return getAnnouncementById(id);
  values.push(id);
  await pool.query(`UPDATE announcements SET ${sets.join(", ")} WHERE id = ?`, values);
  return getAnnouncementById(id);
}

export async function deleteAnnouncement(id) {
  const [result] = await pool.query("DELETE FROM announcements WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

// ============================================================
// Reports
// ============================================================

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function reportMonthlyRequests() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTH_LABELS[d.getMonth()] });
  }
  const [rows] = await pool.query("SELECT DATE_FORMAT(submitted_at, '%Y-%m') AS ym, COUNT(*) AS c FROM requests GROUP BY ym");
  const counts = Object.fromEntries(rows.map((r) => [r.ym, r.c]));
  return months.map((m) => ({ month: m.label, requests: counts[m.key] || 0 }));
}

export async function reportDocumentDistribution() {
  const [rows] = await pool.query(
    `SELECT dt.name, COUNT(r.id) AS value FROM document_types dt LEFT JOIN requests r ON r.doc_type = dt.name GROUP BY dt.name`
  );
  return rows.map((r) => ({ name: r.name, value: Number(r.value) }));
}

export async function reportStatusCounts() {
  const [rows] = await pool.query("SELECT status, COUNT(*) AS count FROM requests GROUP BY status");
  const result = {};
  for (const r of rows) result[r.status] = r.count;
  return result;
}

export async function reportRevenueSummary() {
  const [[row]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM requests WHERE YEAR(submitted_at) = YEAR(CURDATE()) AND MONTH(submitted_at) = MONTH(CURDATE())) AS totalThisMonth,
      (SELECT COUNT(*) FROM requests WHERE status = 'Released' AND YEAR(submitted_at) = YEAR(CURDATE()) AND MONTH(submitted_at) = MONTH(CURDATE())) AS releasedThisMonth,
      (SELECT IFNULL(SUM(fee), 0) FROM requests WHERE paid = 1) AS revenue
  `);
  return { totalThisMonth: row.totalThisMonth, releasedThisMonth: row.releasedThisMonth, revenue: Number(row.revenue) };
}
