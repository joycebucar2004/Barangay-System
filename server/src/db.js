import { pool } from "./mysql.js";

async function columnExists(table, column) {
  const [rows] = await pool.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  return rows.length > 0;
}

// Idempotent, non-destructive: only adds columns / relaxes NOT NULL on email, never drops data.
export async function ensureWalkInSchema() {
  if (!(await columnExists("users", "account_type"))) {
    await pool.query("ALTER TABLE users ADD COLUMN account_type ENUM('Online','Walk-in') NOT NULL DEFAULT 'Online' AFTER status");
  }
  // Walk-in residents have no email; UNIQUE still allows any number of NULLs.
  await pool.query("ALTER TABLE users MODIFY email VARCHAR(150) NULL");
  if (!(await columnExists("requests", "source"))) {
    await pool.query("ALTER TABLE requests ADD COLUMN source ENUM('Online','Walk-in') NOT NULL DEFAULT 'Online' AFTER status");
  }
  if (!(await columnExists("requests", "encoded_by"))) {
    await pool.query("ALTER TABLE requests ADD COLUMN encoded_by VARCHAR(20) DEFAULT NULL AFTER source");
  }
  if (!(await columnExists("requests", "requirements_presented"))) {
    await pool.query("ALTER TABLE requests ADD COLUMN requirements_presented TEXT DEFAULT NULL");
  }
  if (!(await columnExists("announcements", "image"))) {
    await pool.query("ALTER TABLE announcements ADD COLUMN image VARCHAR(255) DEFAULT NULL");
  }
  if (!(await columnExists("requests", "paid_at"))) {
    await pool.query("ALTER TABLE requests ADD COLUMN paid_at DATETIME DEFAULT NULL");
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_number VARCHAR(30) NOT NULL UNIQUE,
    request_id VARCHAR(20) NOT NULL,
    resident_id VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    amount_tendered DECIMAL(10,2) NOT NULL,
    change_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    received_by VARCHAR(20) NOT NULL,
    paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_payments_resident_date (resident_id, paid_at),
    KEY idx_payments_request (request_id)
  ) ENGINE=InnoDB`);
  if (!(await columnExists("document_types", "certificate_template"))) {
    await pool.query("ALTER TABLE document_types ADD COLUMN certificate_template MEDIUMTEXT DEFAULT NULL");
  }
  await ensureCounters();
}

// Recreates the id counters if the table is missing, starting from the highest id already in
// use so new ids never collide with existing ones. INSERT IGNORE leaves existing counters alone.
async function ensureCounters() {
  await pool.query("CREATE TABLE IF NOT EXISTS counters (name VARCHAR(30) PRIMARY KEY, value INT NOT NULL DEFAULT 0) ENGINE=InnoDB");
  const [[max]] = await pool.query(`
    SELECT
      (SELECT IFNULL(MAX(CAST(SUBSTRING(id, 6) AS UNSIGNED)), 0) FROM users WHERE id LIKE 'R-ID-%') AS resident,
      (SELECT IFNULL(MAX(CAST(SUBSTRING(id, 6) AS UNSIGNED)), 0) FROM staff WHERE id LIKE 'S-ID-%') AS staff,
      (SELECT IFNULL(MAX(CAST(SUBSTRING_INDEX(id, '-', -1) AS UNSIGNED)), 0) FROM requests) AS request,
      (SELECT IFNULL(MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)), 0) FROM notifications WHERE id LIKE 'n%') AS notification,
      (SELECT IFNULL(MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)), 0) FROM announcements WHERE id LIKE 'a%') AS announcement
  `);
  for (const [name, value] of Object.entries(max)) {
    await pool.query("INSERT IGNORE INTO counters (name, value) VALUES (?, ?)", [name, Number(value)]);
  }
}

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
    accountType: row.account_type || "Online",
    joined: row.joined,
    lastLoginAt: row.last_login_at,
  };
}

function parseJsonObject(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    residentAccountType: row.resident_account_type || "Online",
    docType: row.doc_type,
    status: row.status,
    source: row.source || "Online",
    encodedBy: row.encoded_by || null,
    encodedByName: row.encoded_by_name || null,
    requirementsPresented: parseJsonArray(row.requirements_presented),
    purpose: row.purpose,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    fee: Number(row.fee),
    paid: !!row.paid,
    amountPaid: Number(row.amount_paid || 0),
    balance: Math.max(0, Number(row.fee) - Number(row.amount_paid || 0)),
    receipts: parseJsonArray(row.receipts).map((p) => ({ ...p, amount: Number(p.amount), amountTendered: Number(p.amountTendered), change: Number(p.change) })),
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
  return { id: row.id, tag: row.tag, title: row.title, body: row.body, date: row.date, image: row.image || null };
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
  // A users row carrying a staff id is a stray duplicate of a staff account -- never treat it as a resident.
  const [residentRows] = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND id NOT LIKE 'S-ID-%' LIMIT 1", [email]);
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
  const [residentRows] = await pool.query("SELECT * FROM users WHERE id NOT LIKE 'S-ID-%' ORDER BY created_at DESC");
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

// A resident record with no login: no email, and a hash of random bytes nobody knows.
export async function createWalkInResident({ firstName, middleName, lastName, gender, civilStatus, dateOfBirth, address, contactNo, unusablePasswordHash }) {
  const id = await nextId("resident", "R-ID-", 3);
  const joined = new Date().toISOString().split("T")[0];
  await pool.query(
    `INSERT INTO users (id, first_name, middle_name, last_name, gender, civil_status, date_of_birth, email, password_hash, temp_password, address, contact_no, status, account_type, joined)
     VALUES (?,?,?,?,?,?,?,NULL,?,NULL,?,?,'Approved','Walk-in',?)`,
    [id, firstName, middleName || "", lastName, gender, civilStatus, dateOfBirth, unusablePasswordHash, address || "", contactNo || "", joined]
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
  const [types] = await pool.query("SELECT name, fee, certificate_template FROM document_types ORDER BY name");
  const [reqs] = await pool.query("SELECT document_type_name, requirement, required FROM document_type_requirements ORDER BY document_type_name, sort_order");
  const byName = {};
  for (const r of reqs) {
    (byName[r.document_type_name] ||= []).push({ requirement: r.requirement, required: !!r.required });
  }
  return types.map((t) => ({ name: t.name, fee: Number(t.fee), requirements: byName[t.name] || [], certificateTemplate: parseJsonObject(t.certificate_template) }));
}

export async function addDocumentType(name, fee) {
  const [existing] = await pool.query("SELECT 1 FROM document_types WHERE name = ?", [name]);
  if (existing.length > 0) throw Object.assign(new Error("Document type already exists"), { status: 409 });
  await pool.query("INSERT INTO document_types (name, fee) VALUES (?, ?)", [name, fee]);
}

export async function addDocumentTypeRequirement(name, requirement, sortOrder, required = true) {
  await pool.query("INSERT INTO document_type_requirements (document_type_name, requirement, required, sort_order) VALUES (?, ?, ?, ?)", [name, requirement, required ? 1 : 0, sortOrder]);
}

// template = null resets the document type to the built-in certificate wording.
export async function setDocumentTypeCertificateTemplate(name, template) {
  await pool.query("UPDATE document_types SET certificate_template = ? WHERE name = ?", [template ? JSON.stringify(template) : null, name]);
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

export async function createRequest({ residentId, residentName, docType, purpose, fee, paid, address, contactNo, dateOfBirth, civilStatus, source = "Online", encodedBy = null, requirementsPresented = null }) {
  const year = new Date().getFullYear();
  await pool.query("UPDATE counters SET value = value + 1 WHERE name = 'request'");
  const [[row]] = await pool.query("SELECT value FROM counters WHERE name = 'request'");
  const id = `BR-${year}-${String(row.value).padStart(3, "0")}`;
  const today = new Date().toISOString().split("T")[0];

  await pool.query(
    `INSERT INTO requests (id, resident_id, doc_type, status, source, encoded_by, requirements_presented, purpose, submitted_at, updated_at, fee, paid, address, contact_no, date_of_birth, civil_status)
     VALUES (?,?,?,'Pending',?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, residentId, docType, source, encodedBy, requirementsPresented ? JSON.stringify(requirementsPresented) : null,
      purpose, today, today, fee, paid ? 1 : 0, address || "", contactNo || "", dateOfBirth || null, civilStatus || null,
    ]
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
    `SELECT r.*, CONCAT(u.first_name, IF(u.middle_name <> '', CONCAT(' ', LEFT(u.middle_name,1), '.'), ''), ' ', u.last_name) AS resident_name,
            u.account_type AS resident_account_type,
            CONCAT(s.first_name, ' ', s.last_name) AS encoded_by_name
     FROM requests r JOIN users u ON u.id = r.resident_id
     LEFT JOIN staff s ON s.id = r.encoded_by
     ${whereSql} ORDER BY r.submitted_at DESC`,
    params
  );
  const requests = rows.map(mapRequest);
  if (requests.length) {
    const ids = requests.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const [payments] = await pool.query(`SELECT receipt_number AS receiptNumber, request_id AS requestId, amount, amount_tendered AS amountTendered, change_amount AS changeAmount, paid_at AS paidAt FROM payments WHERE request_id IN (${placeholders}) ORDER BY paid_at, id`, ids);
    const byRequest = new Map();
    for (const p of payments) {
      const list = byRequest.get(p.requestId) || [];
      list.push({ receiptNumber: p.receiptNumber, amount: Number(p.amount), amountTendered: Number(p.amountTendered), change: Number(p.changeAmount), paidAt: p.paidAt });
      byRequest.set(p.requestId, list);
    }
    for (const request of requests) {
      request.receipts = byRequest.get(request.id) || [];
      request.amountPaid = request.receipts.reduce((total, p) => total + p.amount, 0);
      request.balance = Math.max(0, request.fee - request.amountPaid);
    }
  }
  return attachFiles(requests);
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
  await pool.query("UPDATE requests SET paid = 1, paid_at = NOW() WHERE id = ?", [id]);
  return getRequestById(id);
}

export async function recordRequestPayment(id, residentId, staffId, amountTendered) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT fee, status FROM requests WHERE id = ? AND resident_id = ? FOR UPDATE", [id, residentId]);
    if (!rows[0]) throw Object.assign(new Error("Request not found"), { status: 404 });
    if (rows[0].status === "Rejected" || rows[0].status === "Cancelled") throw Object.assign(new Error("Cannot record payment on a rejected or cancelled request"), { status: 400 });
    const [[paidRow]] = await connection.query("SELECT IFNULL(SUM(amount), 0) AS total FROM payments WHERE request_id = ?", [id]);
    const balance = Math.max(0, Number(rows[0].fee) - Number(paidRow.total));
    if (balance <= 0) throw Object.assign(new Error("Request is already fully paid"), { status: 400 });
    const roundedTender = Math.round(amountTendered * 100) / 100;
    const amount = Math.min(balance, roundedTender);
    const change = Math.max(0, roundedTender - amount);
    await connection.query("INSERT IGNORE INTO counters (name, value) VALUES ('receipt', 0)");
    await connection.query("UPDATE counters SET value = value + 1 WHERE name = 'receipt'");
    const [[seq]] = await connection.query("SELECT value FROM counters WHERE name = 'receipt'");
    const receiptNumber = `RCPT-${new Date().getFullYear()}-${String(seq.value).padStart(6, "0")}`;
    await connection.query("INSERT INTO payments (receipt_number, request_id, resident_id, amount, amount_tendered, change_amount, received_by) VALUES (?, ?, ?, ?, ?, ?, ?)", [receiptNumber, id, residentId, amount, roundedTender, change, staffId]);
    await connection.query("UPDATE requests SET paid = ?, paid_at = IF(? >= fee, NOW(), paid_at) WHERE id = ?", [Number(paidRow.total) + amount >= Number(rows[0].fee) ? 1 : 0, Number(paidRow.total) + amount, id]);
    await connection.commit();
    return getRequestById(id);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function listResidentExpenses(residentId) {
  const [rows] = await pool.query(`SELECT p.receipt_number AS receiptNumber, p.request_id AS requestId, r.doc_type AS docType,
    r.purpose, p.amount, p.amount_tendered AS amountTendered, p.change_amount AS changeAmount,
    p.paid_at AS paidAt FROM payments p JOIN requests r ON r.id = p.request_id
    WHERE p.resident_id = ? ORDER BY p.paid_at DESC`, [residentId]);
  return rows.map((row) => ({ ...row, change: Number(row.changeAmount), amount: Number(row.amount), amountTendered: Number(row.amountTendered) }));
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

export async function createAnnouncement({ tag, title, body, date, image }) {
  const id = await nextId("announcement", "a");
  await pool.query("INSERT INTO announcements (id, tag, title, body, date, image) VALUES (?,?,?,?,?,?)", [id, tag, title, body, date, image || null]);
  return getAnnouncementById(id);
}

export async function updateAnnouncement(id, fields) {
  const columns = { tag: "tag", title: "title", body: "body", date: "date", image: "image" };
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
  // Payments are dated by when they were marked paid (paid_at); older rows fall back to updated_at.
  const [revRows] = await pool.query(
    `SELECT DATE_FORMAT(COALESCE(paid_at, updated_at), '%Y-%m') AS ym, SUM(fee) AS total FROM requests WHERE paid = 1 AND fee > 0 GROUP BY ym`
  );
  const revenue = Object.fromEntries(revRows.map((r) => [r.ym, Number(r.total)]));
  return months.map((m) => ({ month: m.label, requests: counts[m.key] || 0, revenue: revenue[m.key] || 0 }));
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
      (SELECT IFNULL(SUM(fee), 0) FROM requests WHERE paid = 1) AS revenue,
      (SELECT IFNULL(SUM(fee), 0) FROM requests WHERE paid = 1 AND fee > 0
         AND YEAR(COALESCE(paid_at, updated_at)) = YEAR(CURDATE()) AND MONTH(COALESCE(paid_at, updated_at)) = MONTH(CURDATE())) AS revenueThisMonth,
      (SELECT IFNULL(SUM(fee), 0) FROM requests WHERE paid = 0 AND fee > 0 AND status NOT IN ('Rejected', 'Cancelled')) AS outstanding,
      (SELECT COUNT(*) FROM requests WHERE paid = 0 AND fee > 0 AND status NOT IN ('Rejected', 'Cancelled')) AS outstandingCount
  `);
  const [byDoc] = await pool.query(
    "SELECT doc_type AS name, SUM(fee) AS total, COUNT(*) AS count FROM requests WHERE paid = 1 AND fee > 0 GROUP BY doc_type ORDER BY total DESC"
  );
  return {
    totalThisMonth: row.totalThisMonth,
    releasedThisMonth: row.releasedThisMonth,
    revenue: Number(row.revenue),
    revenueThisMonth: Number(row.revenueThisMonth),
    outstanding: Number(row.outstanding),
    outstandingCount: Number(row.outstandingCount),
    revenueByDocType: byDoc.map((d) => ({ name: d.name, total: Number(d.total), count: Number(d.count) })),
  };
}

export async function reportSourceSummary() {
  const [rows] = await pool.query(`
    SELECT source,
           COUNT(*) AS total,
           SUM(YEAR(submitted_at) = YEAR(CURDATE()) AND MONTH(submitted_at) = MONTH(CURDATE())) AS thisMonth
    FROM requests GROUP BY source
  `);
  const [[residents]] = await pool.query("SELECT SUM(account_type = 'Walk-in') AS walkIn, SUM(account_type = 'Online') AS online FROM users");
  const result = {
    requests: { Online: 0, "Walk-in": 0 },
    requestsThisMonth: { Online: 0, "Walk-in": 0 },
    residents: { Online: Number(residents.online || 0), "Walk-in": Number(residents.walkIn || 0) },
  };
  for (const r of rows) {
    result.requests[r.source] = Number(r.total);
    result.requestsThisMonth[r.source] = Number(r.thisMonth || 0);
  }
  return result;
}

export async function reportPeriodSummary({ start, end, bucketFormat, buckets }) {
  const range = [start, end];
  const [totalsRows, requestTrendRows, paymentTrendRows, legacyTrendRows, distributionRows, statusRows, sourceRows, paymentDocRows, legacyDocRows, outstandingRows, residentsRows] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total, SUM(r.status = 'Released') AS released,
        IFNULL(SUM(CASE
          WHEN r.status IN ('Rejected', 'Cancelled') THEN COALESCE(p.total_paid, IF(r.paid = 1, r.fee, 0))
          ELSE r.fee
        END), 0) AS totalBilled
      FROM requests r
      LEFT JOIN (SELECT request_id, SUM(amount) AS total_paid FROM payments GROUP BY request_id) p ON p.request_id = r.id
      WHERE r.submitted_at >= ? AND r.submitted_at < ?`, range),
    pool.query("SELECT DATE_FORMAT(submitted_at, ?) AS bucket, COUNT(*) AS total FROM requests WHERE submitted_at >= ? AND submitted_at < ? GROUP BY bucket", [bucketFormat, ...range]),
    pool.query("SELECT DATE_FORMAT(paid_at, ?) AS bucket, SUM(amount) AS total FROM payments WHERE paid_at >= ? AND paid_at < ? GROUP BY bucket", [bucketFormat, ...range]),
    pool.query(`SELECT DATE_FORMAT(COALESCE(paid_at, updated_at), ?) AS bucket, SUM(fee) AS total FROM requests r
      WHERE paid = 1 AND fee > 0 AND COALESCE(paid_at, updated_at) >= ? AND COALESCE(paid_at, updated_at) < ?
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.request_id = r.id) GROUP BY bucket`, [bucketFormat, ...range]),
    pool.query("SELECT doc_type AS name, COUNT(*) AS value FROM requests WHERE submitted_at >= ? AND submitted_at < ? GROUP BY doc_type", range),
    pool.query("SELECT status, COUNT(*) AS count FROM requests WHERE submitted_at >= ? AND submitted_at < ? GROUP BY status", range),
    pool.query("SELECT source, COUNT(*) AS total FROM requests WHERE submitted_at >= ? AND submitted_at < ? GROUP BY source", range),
    pool.query(`SELECT r.doc_type AS name, SUM(p.amount) AS total, COUNT(*) AS count FROM payments p JOIN requests r ON r.id = p.request_id
      WHERE p.paid_at >= ? AND p.paid_at < ? GROUP BY r.doc_type`, range),
    pool.query(`SELECT doc_type AS name, SUM(fee) AS total, COUNT(*) AS count FROM requests r
      WHERE paid = 1 AND fee > 0 AND COALESCE(paid_at, updated_at) >= ? AND COALESCE(paid_at, updated_at) < ?
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.request_id = r.id) GROUP BY doc_type`, range),
    pool.query(`SELECT IFNULL(SUM(GREATEST(r.fee - IFNULL(p.total_paid, 0), 0)), 0) AS outstanding, COUNT(*) AS count
      FROM requests r LEFT JOIN (SELECT request_id, SUM(amount) AS total_paid FROM payments GROUP BY request_id) p ON p.request_id = r.id
      WHERE r.submitted_at >= ? AND r.submitted_at < ? AND r.status NOT IN ('Rejected', 'Cancelled')
      AND r.paid = 0 AND r.fee > IFNULL(p.total_paid, 0)`, range),
    pool.query("SELECT SUM(account_type = 'Walk-in') AS walkIn, SUM(account_type = 'Online') AS online FROM users"),
  ]);
  const [[totals]] = totalsRows;
  const [requestTrend] = requestTrendRows;
  const [paymentTrend] = paymentTrendRows;
  const [legacyTrend] = legacyTrendRows;
  const [distribution] = distributionRows;
  const [statuses] = statusRows;
  const [sources] = sourceRows;
  const [paymentDocs] = paymentDocRows;
  const [legacyDocs] = legacyDocRows;
  const [[outstanding]] = outstandingRows;
  const [[residents]] = residentsRows;

  const requestsByBucket = Object.fromEntries(requestTrend.map((row) => [row.bucket, Number(row.total)]));
  const revenueByBucket = {};
  for (const row of [...paymentTrend, ...legacyTrend]) revenueByBucket[row.bucket] = (revenueByBucket[row.bucket] || 0) + Number(row.total);
  const monthly = buckets.map(({ key, label }) => ({ month: label, requests: requestsByBucket[key] || 0, revenue: revenueByBucket[key] || 0 }));
  const byDocument = new Map();
  for (const row of [...paymentDocs, ...legacyDocs]) {
    const existing = byDocument.get(row.name) || { name: row.name, total: 0, count: 0 };
    existing.total += Number(row.total);
    existing.count += Number(row.count);
    byDocument.set(row.name, existing);
  }
  const totalRevenue = monthly.reduce((sum, bucket) => sum + bucket.revenue, 0);
  const sourceCounts = { Online: 0, "Walk-in": 0 };
  for (const row of sources) sourceCounts[row.source] = Number(row.total);
  const statusCounts = {};
  for (const row of statuses) statusCounts[row.status] = Number(row.count);

  return {
    totalThisMonth: Number(totals.total || 0),
    releasedThisMonth: Number(totals.released || 0),
    totalBilled: Number(totals.totalBilled || 0),
    revenue: totalRevenue,
    revenueThisMonth: totalRevenue,
    outstanding: Number(outstanding.outstanding || 0),
    outstandingCount: Number(outstanding.count || 0),
    revenueByDocType: [...byDocument.values()].sort((a, b) => b.total - a.total),
    monthly,
    distribution: distribution.map((row) => ({ name: row.name, value: Number(row.value) })),
    statusCounts,
    sources: {
      requests: sourceCounts,
      requestsThisMonth: sourceCounts,
      residents: { Online: Number(residents.online || 0), "Walk-in": Number(residents.walkIn || 0) },
    },
  };
}
