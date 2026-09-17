import { Router } from "express";
import { listDocumentTypes, addDocumentType, addDocumentTypeRequirement, updateDocumentTypeFee, replaceDocumentTypeRequirements } from "../db.js";
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
