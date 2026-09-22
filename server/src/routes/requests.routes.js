import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getUserById, fullName, listDocumentTypes, listRequestsForResident, listAllRequests, getRequestById, createRequest, createWalkInResident, addRequestFiles, replaceRequestFile, updateRequestStatus, markRequestPaid, markRequestPrinted } from "../db.js";
import { authRequired, requireRole, toPublicUser } from "../auth.js";
import { upload } from "../upload.js";
import { notifyUser, notifyRole } from "../notify.js";

export const requestsRouter = Router();

const ALLOWED_TRANSITIONS = {
  Pending: ["Verified", "Rejected"],
  Verified: ["Approved"],
  Approved: ["Ready for Pickup"],
  "Ready for Pickup": ["Released"],
};

// Staff handles the whole decision pipeline: checking submitted requirements (Pending ->
// Verified/Rejected), giving final approval (Verified -> Approved), and printing the certificate
// (see the /print route), all the way through ready for pickup and released. Admin has no
// transition rights here -- their dashboard is a read-only view of status and the certificate.
function canTransition(role, from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) return false;
  return role === "staff";
}

requestsRouter.get("/", authRequired, async (req, res, next) => {
  try {
    const requests = req.userRole === "resident" ? await listRequestsForResident(req.userId) : await listAllRequests();
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/:id", authRequired, async (req, res, next) => {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (req.userRole === "resident" && request.residentId !== req.userId) {
      return res.status(403).json({ error: "Not authorized to view this request" });
    }
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/", authRequired, requireRole("resident"), upload.array("files", 10), async (req, res, next) => {
  try {
    const { docType, purpose } = req.body || {};
    if (!docType || !purpose) return res.status(400).json({ error: "Document type and purpose are required" });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one supporting file is required" });
    }

    const documentTypes = await listDocumentTypes();
    const docConfig = documentTypes.find((d) => d.name === docType);
    if (!docConfig) return res.status(400).json({ error: "Unknown document type" });

    // Each uploaded file is paired with the requirement it satisfies (same order as req.files) --
    // enforced here so a resident can't submit without covering every required item.
    const rawLabels = req.body.requirementLabels;
    const requirementLabels = Array.isArray(rawLabels) ? rawLabels : rawLabels ? [rawLabels] : [];
    if (requirementLabels.length !== req.files.length) {
      return res.status(400).json({ error: "Each uploaded file must be matched to a requirement" });
    }
    const requiredNames = docConfig.requirements.filter((r) => r.required).map((r) => r.requirement);
    const missing = requiredNames.filter((name) => !requirementLabels.includes(name));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required document(s): ${missing.join(", ")}` });
    }

    const user = await getUserById(req.userId);
    const request = await createRequest({
      residentId: user.id,
      residentName: fullName(user),
      docType,
      purpose,
      fee: docConfig.fee,
      paid: docConfig.fee === 0,
      address: user.address,
      contactNo: user.contactNo,
      dateOfBirth: user.dateOfBirth,
      civilStatus: user.civilStatus || "",
    });
    const files = req.files.map((f, i) => ({ originalName: f.originalname, storedName: f.filename, requirement: requirementLabels[i] }));
    await addRequestFiles(request.id, files);
    request.files = files;

    await notifyUser(user.id, `Your ${docType} (${request.id}) has been received and is now under review.`);
    await notifyRole("staff", `New ${docType} request (${request.id}) from ${fullName(user)} needs review.`);

    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
});

const VALID_GENDERS = ["Male", "Female", "Other"];
const VALID_CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated", "Divorced"];

function toArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

// Staff encoding a request for someone at the counter who has no online account. Either picks
// an existing resident record (residentId) or supplies personal details for a new walk-in record.
// Requirements are checked in person (requirementsPresented); scans are optional.
requestsRouter.post("/walk-in", authRequired, requireRole("staff"), upload.array("files", 10), async (req, res, next) => {
  try {
    const body = req.body || {};
    const docType = (body.docType || "").trim();
    const purpose = (body.purpose || "").trim();
    if (!docType || !purpose) return res.status(400).json({ error: "Document type and purpose are required" });

    const documentTypes = await listDocumentTypes();
    const docConfig = documentTypes.find((d) => d.name === docType);
    if (!docConfig) return res.status(400).json({ error: "Unknown document type" });

    const validNames = docConfig.requirements.map((r) => r.requirement);
    let presented;
    try {
      presented = toArray(body.requirementsPresented ? JSON.parse(body.requirementsPresented) : []);
    } catch {
      return res.status(400).json({ error: "Invalid requirements checklist" });
    }
    presented = presented.filter((name) => validNames.includes(name));

    const files = req.files || [];
    const requirementLabels = toArray(body.requirementLabels);
    if (requirementLabels.length !== files.length || requirementLabels.some((l) => !validNames.includes(l))) {
      return res.status(400).json({ error: "Each uploaded file must be matched to a requirement" });
    }

    const covered = new Set([...presented, ...requirementLabels]);
    const missing = docConfig.requirements.filter((r) => r.required && !covered.has(r.requirement)).map((r) => r.requirement);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required document(s): ${missing.join(", ")}` });
    }

    let resident;
    if (body.residentId) {
      resident = await getUserById(body.residentId);
      if (!resident || resident.role !== "resident") return res.status(404).json({ error: "Resident not found" });
      if (resident.accountType !== "Walk-in" && resident.status !== "Approved") {
        return res.status(400).json({ error: "This resident's online account isn't approved yet" });
      }
    } else {
      const firstName = (body.firstName || "").trim();
      const lastName = (body.lastName || "").trim();
      const { gender, civilStatus, dateOfBirth } = body;
      if (!firstName || !lastName || !gender || !civilStatus || !dateOfBirth) {
        return res.status(400).json({ error: "First name, last name, gender, civil status and date of birth are required" });
      }
      if (!VALID_GENDERS.includes(gender)) return res.status(400).json({ error: "Invalid gender" });
      if (!VALID_CIVIL_STATUSES.includes(civilStatus)) return res.status(400).json({ error: "Invalid civil status" });
      if (Number.isNaN(Date.parse(dateOfBirth)) || new Date(dateOfBirth) > new Date()) {
        return res.status(400).json({ error: "Invalid date of birth" });
      }
      resident = await createWalkInResident({
        firstName,
        middleName: (body.middleName || "").trim(),
        lastName,
        gender,
        civilStatus,
        dateOfBirth,
        address: (body.address || "").trim(),
        contactNo: (body.contactNo || "").trim(),
        unusablePasswordHash: bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10),
      });
    }

    const request = await createRequest({
      residentId: resident.id,
      residentName: fullName(resident),
      docType,
      purpose,
      fee: docConfig.fee,
      paid: docConfig.fee === 0,
      address: resident.address,
      contactNo: resident.contactNo,
      dateOfBirth: resident.dateOfBirth,
      civilStatus: resident.civilStatus || "",
      source: "Walk-in",
      encodedBy: req.userId,
      requirementsPresented: presented,
    });
    const savedFiles = files.map((f, i) => ({ originalName: f.originalname, storedName: f.filename, requirement: requirementLabels[i] }));
    await addRequestFiles(request.id, savedFiles);

    if (resident.accountType !== "Walk-in") {
      await notifyUser(resident.id, `A walk-in ${docType} request (${request.id}) was filed for you at the Barangay Hall.`);
    }
    await notifyRole("admin", `Walk-in ${docType} request (${request.id}) for ${fullName(resident)} was encoded by staff.`);

    res.status(201).json({ request: await getRequestById(request.id), resident: toPublicUser(resident) });
  } catch (err) {
    next(err);
  }
});

requestsRouter.patch("/:id/status", authRequired, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const { status, remarks } = req.body || {};
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (!canTransition(req.userRole, request.status, status)) {
      return res.status(400).json({ error: `Cannot change status from ${request.status} to ${status}` });
    }
    if (status === "Rejected" && (!remarks || !remarks.trim())) {
      return res.status(400).json({ error: "Please explain what's incomplete or incorrect so the resident can fix it" });
    }
    if (status === "Ready for Pickup" && !request.printedAt) {
      return res.status(400).json({ error: "The certificate must be printed before marking this ready for pickup" });
    }
    if (status === "Ready for Pickup" && !request.paid) {
      return res.status(400).json({ error: "Mark this request as paid before marking it ready for pickup" });
    }

    const paid = status === "Verified" || status === "Approved" ? request.paid || request.fee === 0 : undefined;
    const updated = await updateRequestStatus(req.params.id, { status, remarks: remarks || undefined, paid });

    const messages = {
      Verified: `Your ${request.docType} (${request.id}) has been verified and is awaiting approval.`,
      Rejected: `Your ${request.docType} (${request.id}) was rejected: ${remarks}`,
      Approved: `Your ${request.docType} (${request.id}) has been approved.`,
      "Ready for Pickup": `Your ${request.docType} (${request.id}) is ready for pickup at the Barangay Hall.`,
      Released: `Your ${request.docType} (${request.id}) has been released. Thank you!`,
    };
    if (messages[status] && request.residentAccountType !== "Walk-in") await notifyUser(request.residentId, messages[status]);
    if (status === "Verified") await notifyRole("staff", `Request ${request.id} (${request.docType}) is verified and awaiting approval.`);
    if (status === "Approved") await notifyRole("admin", `Request ${request.id} (${request.docType}) has been approved by staff.`);

    res.json({ request: updated });
  } catch (err) {
    next(err);
  }
});

// A resident adding or fixing up requirements: replaces the file for whichever requirement(s)
// they re-upload. Available any time before a request is formally decided (Pending, Verified, or
// Rejected) -- not just after a rejection, since a resident might notice something's missing on
// their own. Editing files always sends it back to Pending: if staff had already verified it,
// that verification is now stale and needs a fresh look.
requestsRouter.patch("/:id/resubmit", authRequired, requireRole("resident"), upload.array("files", 10), async (req, res, next) => {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.residentId !== req.userId) {
      return res.status(403).json({ error: "Not authorized to update this request" });
    }
    if (!["Pending", "Verified", "Rejected"].includes(request.status)) {
      return res.status(400).json({ error: `A ${request.status.toLowerCase()} request can no longer be edited` });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please attach at least one file" });
    }

    const documentTypes = await listDocumentTypes();
    const docConfig = documentTypes.find((d) => d.name === request.docType);
    if (!docConfig) return res.status(400).json({ error: "Unknown document type" });

    const rawLabels = req.body.requirementLabels;
    const requirementLabels = Array.isArray(rawLabels) ? rawLabels : rawLabels ? [rawLabels] : [];
    if (requirementLabels.length !== req.files.length) {
      return res.status(400).json({ error: "Each uploaded file must be matched to a requirement" });
    }

    for (let i = 0; i < req.files.length; i++) {
      await replaceRequestFile(request.id, requirementLabels[i], { originalName: req.files[i].originalname, storedName: req.files[i].filename });
    }

    const afterUpdate = await getRequestById(request.id);
    const requiredNames = docConfig.requirements.filter((r) => r.required).map((r) => r.requirement);
    const coveredNames = afterUpdate.files.map((f) => f.requirement);
    const stillMissing = requiredNames.filter((name) => !coveredNames.includes(name));
    if (stillMissing.length > 0) {
      return res.status(400).json({ error: `Still missing required document(s): ${stillMissing.join(", ")}` });
    }

    const wasRejected = request.status === "Rejected";
    const updated = await updateRequestStatus(request.id, { status: "Pending", remarks: wasRejected ? null : undefined });
    const user = await getUserById(req.userId);
    const verb = wasRejected ? "resubmitted" : "updated";
    await notifyUser(req.userId, `Your ${request.docType} (${request.id}) has been ${verb} and is now under review.`);
    await notifyRole("staff", `Request ${request.id} (${request.docType}) was ${verb} by ${fullName(user)} and needs review.`);

    res.json({ request: updated });
  } catch (err) {
    next(err);
  }
});

const NON_CANCELLABLE_STATUSES = ["Released", "Rejected", "Cancelled"];

requestsRouter.patch("/:id/cancel", authRequired, requireRole("resident"), async (req, res, next) => {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.residentId !== req.userId) {
      return res.status(403).json({ error: "Not authorized to update this request" });
    }
    if (NON_CANCELLABLE_STATUSES.includes(request.status)) {
      return res.status(400).json({ error: `A ${request.status.toLowerCase()} request can't be cancelled` });
    }

    const updated = await updateRequestStatus(request.id, { status: "Cancelled" });
    await notifyRole("staff", `Request ${request.id} (${request.docType}) was cancelled by the resident.`);

    res.json({ request: updated });
  } catch (err) {
    next(err);
  }
});

// Printing the official certificate is staff's job, same as the rest of the pipeline. It no
// longer requires payment up front: payment is collected afterward, once the resident actually
// comes in with a printed copy in hand. Admin is notified for visibility only -- they can view
// the certificate and its status but have no action to take here.
const PRINTABLE_STATUSES = ["Approved", "Ready for Pickup", "Released"];

requestsRouter.patch("/:id/print", authRequired, requireRole("staff"), async (req, res, next) => {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (!PRINTABLE_STATUSES.includes(request.status)) {
      return res.status(400).json({ error: "This request hasn't been approved yet" });
    }

    const updated = await markRequestPrinted(req.params.id);
    await notifyRole("admin", `Request ${request.id} (${request.docType}) has been printed by staff and is ready for payment collection.`);

    res.json({ request: updated });
  } catch (err) {
    next(err);
  }
});

requestsRouter.patch("/:id/payment", authRequired, requireRole("staff"), async (req, res, next) => {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status === "Rejected") {
      return res.status(400).json({ error: "Cannot record payment on a rejected request" });
    }
    if (request.paid) {
      return res.status(400).json({ error: "Request is already marked as paid" });
    }
    if (!request.printedAt) {
      return res.status(400).json({ error: "The certificate must be printed by the admin before payment can be recorded" });
    }

    const updated = await markRequestPaid(req.params.id);
    res.json({ request: updated });
  } catch (err) {
    next(err);
  }
});
