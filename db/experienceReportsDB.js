import { ObjectId } from "mongodb";
import { getDB } from "./myMongoDB.js";

const COLLECTION = "experienceReports";

function experienceReports() {
  return getDB().collection(COLLECTION);
}

export async function createExperienceReportIndexes() {
  await experienceReports().createIndexes([
    { key: { providerId: 1, createdAt: -1 } },
    {
      key: {
        therapyType: 1,
        visitFormat: 1,
        rating: 1,
        wouldRecommend: 1,
      },
    },
    { key: { authorId: 1 } },
  ]);
}

export async function findExperienceReports({
  providerId,
  therapyType,
  visitFormat,
  rating,
  wouldRecommend,
  page = 1,
  limit = 20,
}) {
  const filter = {};

  if (providerId && ObjectId.isValid(providerId)) {
    filter.providerId = new ObjectId(providerId);
  }

  if (therapyType) filter.therapyType = therapyType;
  if (visitFormat) filter.visitFormat = visitFormat;
  if (rating) filter.rating = rating;

  if (typeof wouldRecommend === "boolean") {
    filter.wouldRecommend = wouldRecommend;
  }

  const [items, total] = await Promise.all([
    experienceReports()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    experienceReports().countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function findExperienceReportById(id) {
  if (!ObjectId.isValid(id)) return null;

  return experienceReports().findOne({
    _id: new ObjectId(id),
  });
}

export async function createExperienceReport(report) {
  const now = new Date();

  const document = {
    providerId: new ObjectId(report.providerId),
    therapyType: report.therapyType,
    visitFormat: report.visitFormat,
    rating: report.rating,
    wouldRecommend: report.wouldRecommend,
    experienceSummary: report.experienceSummary,
    experiencedAt: new Date(report.experiencedAt),
    authorId: report.authorId,
    createdAt: now,
    updatedAt: now,
  };

  const result = await experienceReports().insertOne(document);

  return {
    ...document,
    _id: result.insertedId,
  };
}

export async function updateExperienceReport(id, authorId, updates) {
  if (!ObjectId.isValid(id) || !ObjectId.isValid(updates.providerId)) {
    return null;
  }

  const result = await experienceReports().updateOne(
    {
      _id: new ObjectId(id),
      authorId,
    },
    {
      $set: {
        providerId: new ObjectId(updates.providerId),
        therapyType: updates.therapyType,
        visitFormat: updates.visitFormat,
        rating: updates.rating,
        wouldRecommend: updates.wouldRecommend,
        experienceSummary: updates.experienceSummary,
        experiencedAt: new Date(updates.experiencedAt),
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) return null;

  return findExperienceReportById(id);
}

export async function deleteExperienceReport(id, authorId) {
  if (!ObjectId.isValid(id)) return false;

  const result = await experienceReports().deleteOne({
    _id: new ObjectId(id),
    authorId,
  });

  return result.deletedCount === 1;
}

export async function getProviderExperienceSummary(providerId) {
  if (!ObjectId.isValid(providerId)) {
    return {
      averageRating: null,
      reportCount: 0,
    };
  }

  const results = await experienceReports()
    .aggregate([
      {
        $match: {
          providerId: new ObjectId(providerId),
        },
      },
      {
        $group: {
          _id: "$providerId",
          averageRating: { $avg: "$rating" },
          reportCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          averageRating: { $round: ["$averageRating", 1] },
          reportCount: 1,
        },
      },
    ])
    .toArray();

  return (
    results[0] || {
      averageRating: null,
      reportCount: 0,
    }
  );
}
