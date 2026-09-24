import { Router } from "express";
import { listDocumentTypes, addDocumentType, addDocumentTypeRequirement, updateDocumentTypeFee, replaceDocumentTypeRequirements, setDocumentTypeCertificateTemplate } from "../db.js";
import { notifyRole } from "../notify.js";
import { authRequired, requireRole } from "../auth.js";

export const documentTypesRouter = Router();

function isValidRequirements(requirements) {
  return (
    Array.isArray(requirements) &&
    requirements.every((r) => r && typeof r.requirement === "string" && r.requirement.trim() && typeof r.required === "boolean")
  );
}

documentTypesRouter.get("/", async (req, res, next) => {
  try {
    res.json({ documentTypes: await listDocumentTypes() });
  } catch (err) {
    next(err);
  }
});

documentTypesRouter.post("/", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, fee, requirements } = req.body || {};
    if (!name || fee === undefined || !isValidRequirements(requirements)) {
      return res.status(400).json({ error: "name, fee and requirements[] ({ requirement, required }) are required" });
    }
    await addDocumentType(name, Number(fee));
    for (let i = 0; i < requirements.length; i++) {
      await addDocumentTypeRequirement(name, requirements[i].requirement, i + 1, requirements[i].required);
    }
    res.status(201).json({ documentType: { name, fee: Number(fee), requirements } });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
});

documentTypesRouter.put("/:name", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const { fee, requirements } = req.body || {};
    const documentTypes = await listDocumentTypes();
    const doc = documentTypes.find((d) => d.name === req.params.name);
    if (!doc) return res.status(404).json({ error: "Document type not found" });

    if (fee !== undefined) {
      await updateDocumentTypeFee(req.params.name, Number(fee));
      doc.fee = Number(fee);
    }
    if (requirements !== undefined) {
      if (!isValidRequirements(requirements)) {
        return res.status(400).json({ error: "requirements[] must be objects of { requirement, required }" });
      }
      await replaceDocumentTypeRequirements(req.params.name, requirements);
      doc.requirements = requirements;
    }
    res.json({ documentType: doc });
  } catch (err) {
    next(err);
  }
});

const TEMPLATE_FIELDS = ["title", "body", "issued", "signatoryName", "signatoryTitle"];
const ALLOWED_TEMPLATE_TAGS = new Set(["b", "strong", "i", "em", "u", "br", "sup", "sub", "p", "div", "span"]);

// Keeps only basic formatting tags with every attribute stripped, so a saved template can't carry
// scripts or event handlers into staff/resident pages. {{PLACEHOLDER}} tokens are plain text.
function sanitizeTemplateHtml(html) {
  return html
    .replace(/<(script|style|iframe|object|embed|template)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(\/?)\s*([a-z0-9]+)\b[^>]*>/gi, (_, slash, tag) => (ALLOWED_TEMPLATE_TAGS.has(tag.toLowerCase()) ? `<${slash}${tag.toLowerCase()}>` : ""));
}

// Admin edits the certificate wording once per document type; every request of that type fills
// in its own resident details. { template: null } resets to the built-in wording.
documentTypesRouter.put("/:name/certificate-template", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const documentTypes = await listDocumentTypes();
    const doc = documentTypes.find((d) => d.name === req.params.name);
    if (!doc) return res.status(404).json({ error: "Document type not found" });

    const { template } = req.body || {};
    if (template === null) {
      await setDocumentTypeCertificateTemplate(doc.name, null);
      return res.json({ documentType: { ...doc, certificateTemplate: null } });
    }
    if (!template || typeof template !== "object") return res.status(400).json({ error: "Certificate template is required" });

    const clean = {};
    for (const field of TEMPLATE_FIELDS) {
      const value = template[field];
      if (typeof value !== "string" || value.length > 20000) {
        return res.status(400).json({ error: `Invalid certificate field: ${field}` });
      }
      clean[field] = sanitizeTemplateHtml(value);
    }
    if (!clean.body.includes("{{NAME}}") || !clean.body.includes("{{PURPOSE}}")) {
      return res.status(400).json({ error: "The certificate body must include the Resident Name and Purpose placeholders" });
    }

    await setDocumentTypeCertificateTemplate(doc.name, clean);
    await notifyRole("staff", `The ${doc.name} certificate template was updated by the admin.`);
    res.json({ documentType: { ...doc, certificateTemplate: clean } });
  } catch (err) {
    next(err);
  }
});
