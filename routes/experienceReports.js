import { Router } from "express";
import {
  createExperienceReport,
  deleteExperienceReport,
  findExperienceReportById,
  findExperienceReports,
  findOwnedExperienceReports,
  getProviderExperienceSummary,
  updateExperienceReport,
} from "../db/experienceReportsDB.js";
import { providerExists } from "../db/providersDB.js";
import { isOwner, toPublic } from "../middleware/anonymousId.js";

const router = Router();
const MAX_LIMIT = 50;
const MAX_SUMMARY_LENGTH = 300;

const THERAPY_TYPES = ["Individual", "Couples", "Family", "Group"];
const VISIT_FORMATS = ["In person", "Telehealth", "Hybrid"];

function toPositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function validateReport(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A report object is required" };
  }

  const providerId =
    typeof body.providerId === "string" ? body.providerId.trim() : "";
  const therapyType =
    typeof body.therapyType === "string" ? body.therapyType.trim() : "";
  const visitFormat =
    typeof body.visitFormat === "string" ? body.visitFormat.trim() : "";
  const rating = Number(body.rating);
  const experiencedAt =
    typeof body.experiencedAt === "string" ? body.experiencedAt.trim() : "";

  let experienceSummary = "";
  if (body.experienceSummary !== undefined && body.experienceSummary !== null) {
    if (typeof body.experienceSummary !== "string") {
      return { error: "Experience summary must be text" };
    }

    experienceSummary = body.experienceSummary.trim();
  }

  if (!providerId) {
    return { error: "Provider is required" };
  }

  if (!THERAPY_TYPES.includes(therapyType)) {
    return { error: "Select a valid therapy type" };
  }

  if (!VISIT_FORMATS.includes(visitFormat)) {
    return { error: "Select a valid visit format" };
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Rating must be a whole number from 1 to 5" };
  }

  if (typeof body.wouldRecommend !== "boolean") {
    return { error: "Recommendation must be true or false" };
  }

  if (experienceSummary.length > MAX_SUMMARY_LENGTH) {
    return {
      error: `Experience summary cannot exceed ${MAX_SUMMARY_LENGTH} characters`,
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(experiencedAt)) {
    return { error: "Enter a valid experience date" };
  }

  const experienceDate = new Date(`${experiencedAt}T00:00:00.000Z`);

  if (
    Number.isNaN(experienceDate.getTime()) ||
    experienceDate.toISOString().slice(0, 10) !== experiencedAt
  ) {
    return { error: "Enter a valid experience date" };
  }

  if (experienceDate > new Date()) {
    return { error: "Experience date cannot be in the future" };
  }

  return {
    value: {
      providerId,
      therapyType,
      visitFormat,
      rating,
      wouldRecommend: body.wouldRecommend,
      experienceSummary,
      experiencedAt,
    },
  };
}

router.get("/", async (req, res) => {
  const providerId =
    typeof req.query.providerId === "string" ? req.query.providerId.trim() : "";
  const therapyType =
    typeof req.query.therapyType === "string"
      ? req.query.therapyType.trim()
      : "";
  const visitFormat =
    typeof req.query.visitFormat === "string"
      ? req.query.visitFormat.trim()
      : "";

  let rating;
  if (req.query.rating !== undefined) {
    rating = Number(req.query.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ error: "Rating filter must be a whole number from 1 to 5" });
    }
  }

  let wouldRecommend;
  if (req.query.wouldRecommend !== undefined) {
    if (
      req.query.wouldRecommend !== "true" &&
      req.query.wouldRecommend !== "false"
    ) {
      return res.status(400).json({
        error: "Recommendation filter must be true or false",
      });
    }

    wouldRecommend = req.query.wouldRecommend === "true";
  }

  if (therapyType && !THERAPY_TYPES.includes(therapyType)) {
    return res.status(400).json({ error: "Invalid therapy type filter" });
  }

  if (visitFormat && !VISIT_FORMATS.includes(visitFormat)) {
    return res.status(400).json({ error: "Invalid visit format filter" });
  }

  if (providerId && !(await providerExists(providerId))) {
    return res.status(404).json({ error: "Provider not found" });
  }

  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 10), MAX_LIMIT);

  const result = await findExperienceReports({
    providerId,
    therapyType,
    visitFormat,
    rating,
    wouldRecommend,
    page,
    limit,
  });

  res.json({
    ...result,
    items: result.items.map((report) => toPublic(req, report)),
  });
});

router.get("/summary/:providerId", async (req, res) => {
  if (!(await providerExists(req.params.providerId))) {
    return res.status(404).json({ error: "Provider not found" });
  }

  res.json(await getProviderExperienceSummary(req.params.providerId));
});

router.get("/mine", async (req, res) => {
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 10), MAX_LIMIT);

  const result = await findOwnedExperienceReports({
    authorId: req.anonId,
    page,
    limit,
  });

  res.json({
    ...result,
    items: result.items.map((report) => toPublic(req, report)),
  });
});

router.get("/:id", async (req, res) => {
  const report = await findExperienceReportById(req.params.id);

  if (!report) {
    return res.status(404).json({ error: "Experience report not found" });
  }

  res.json(toPublic(req, report));
});

router.post("/", async (req, res) => {
  const validation = validateReport(req.body);

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  if (!(await providerExists(validation.value.providerId))) {
    return res.status(404).json({ error: "Provider not found" });
  }

  const report = await createExperienceReport({
    ...validation.value,
    authorId: req.anonId,
  });

  res.status(201).json(toPublic(req, report));
});

router.put("/:id", async (req, res) => {
  const existingReport = await findExperienceReportById(req.params.id);

  if (!existingReport) {
    return res.status(404).json({ error: "Experience report not found" });
  }

  if (!isOwner(req, existingReport)) {
    return res
      .status(403)
      .json({ error: "You can only edit your own experience reports" });
  }

  const validation = validateReport(req.body);

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  if (!(await providerExists(validation.value.providerId))) {
    return res.status(404).json({ error: "Provider not found" });
  }

  const report = await updateExperienceReport(
    req.params.id,
    req.anonId,
    validation.value
  );

  res.json(toPublic(req, report));
});

router.delete("/:id", async (req, res) => {
  const existingReport = await findExperienceReportById(req.params.id);

  if (!existingReport) {
    return res.status(404).json({ error: "Experience report not found" });
  }

  if (!isOwner(req, existingReport)) {
    return res
      .status(403)
      .json({ error: "You can only delete your own experience reports" });
  }

  await deleteExperienceReport(req.params.id, req.anonId);
  res.status(204).send();
});

export default router;
