import { Router } from "express";
import { ObjectId } from "mongodb";
import { findProviderById, providerExists } from "../db/providersDB.js";
import {
  OUTDATED_AFTER_DAYS,
  outdatedCutoff,
  insertReport,
  findReportById,
  findReportsForProvider,
  updateReport,
  deleteReport,
  findProvidersWithStatus,
  getCitySummary,
} from "../db/availabilityReportsDB.js";
import {
  STATUS_OPTIONS,
  ACCEPTING_STATUSES,
  INSURANCES,
  NOTES_MAX,
  validateReport,
} from "../validation/availabilityValidation.js";
import { isOwner, toPublic } from "../middleware/anonymousId.js";

const router = Router();
const MAX_LIMIT = 50;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

router.get("/options", (req, res) => {
  res.json({
    statuses: STATUS_OPTIONS,
    insurances: INSURANCES,
    notesMax: NOTES_MAX,
    outdatedAfterDays: OUTDATED_AFTER_DAYS,
  });
});

router.get("/providers", async (req, res) => {
  const status = ACCEPTING_STATUSES.includes(req.query.status)
    ? req.query.status
    : "";
  const insurance = INSURANCES.includes(req.query.insurance)
    ? req.query.insurance
    : "";

  const result = await findProvidersWithStatus({
    q: text(req.query.q),
    city: text(req.query.city),
    status,
    insurance,
    telehealth: req.query.telehealth === "true",
    page: toPositiveInt(req.query.page, 1),
    limit: Math.min(toPositiveInt(req.query.limit, 20), MAX_LIMIT),
  });
  res.json(result);
});

router.get("/providers/:providerId", async (req, res) => {
  const provider = await findProviderById(req.params.providerId);
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  const cutoff = outdatedCutoff();
  const history = (await findReportsForProvider(provider._id)).map(
    (report) => ({
      ...toPublic(req, report),
      isOutdated: report.createdAt < cutoff,
    })
  );
  const current = history.find((report) => !report.isOutdated) ?? null;

  res.json({ provider, current, history });
});

router.get("/summary", async (req, res) => {
  res.json(await getCitySummary(text(req.query.city)));
});

router.post("/reports", async (req, res) => {
  const body = req.body ?? {};
  const { errors, value } = validateReport(body);
  if (errors.length > 0) return res.status(400).json({ errors });

  if (!(await providerExists(body.providerId))) {
    return res.status(400).json({ errors: ["That provider does not exist."] });
  }

  const report = await insertReport({
    providerId: new ObjectId(body.providerId),
    ...value,
    authorId: req.anonId,
  });
  res.status(201).json(toPublic(req, report));
});

router.put("/reports/:id", async (req, res) => {
  const existing = await findReportById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Report not found" });
  if (!isOwner(req, existing)) {
    return res
      .status(403)
      .json({ error: "You can only edit reports you submitted." });
  }

  const { errors, value } = validateReport(req.body ?? {}, {
    requireProvider: false,
  });
  if (errors.length > 0) return res.status(400).json({ errors });

  const updated = await updateReport(existing._id, value);
  res.json(toPublic(req, updated));
});

router.delete("/reports/:id", async (req, res) => {
  const existing = await findReportById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Report not found" });
  if (!isOwner(req, existing)) {
    return res
      .status(403)
      .json({ error: "You can only delete reports you submitted." });
  }

  await deleteReport(existing._id);
  res.status(204).end();
});

export default router;
