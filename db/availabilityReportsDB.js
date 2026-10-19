import { ObjectId } from "mongodb";
import { getDB } from "./myMongoDB.js";
import { escapeRegex } from "./providersDB.js";

export const OUTDATED_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function reports() {
  return getDB().collection("availabilityReports");
}

function providers() {
  return getDB().collection("providers");
}

export function outdatedCutoff(now = new Date()) {
  return new Date(now.getTime() - OUTDATED_AFTER_DAYS * DAY_MS);
}

export async function createAvailabilityIndexes() {
  await reports().createIndexes([
    { key: { providerId: 1, createdAt: -1 } },
    { key: { createdAt: -1 } },
    { key: { authorId: 1 } },
  ]);
}

export async function insertReport(report) {
  const now = new Date();
  const doc = { ...report, createdAt: now, updatedAt: now };
  const result = await reports().insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

export async function findReportById(id) {
  if (!ObjectId.isValid(id)) return null;
  return reports().findOne({ _id: new ObjectId(id) });
}

export async function findReportsForProvider(providerId) {
  return reports()
    .find({ providerId: new ObjectId(providerId) })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function updateReport(id, changes) {
  return reports().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...changes, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
}

export async function deleteReport(id) {
  const result = await reports().deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

export async function findProvidersWithStatus({
  q,
  city,
  status,
  insurance,
  telehealth,
  page,
  limit,
}) {
  const providerMatch = {};
  if (q) providerMatch.name = { $regex: escapeRegex(q), $options: "i" };
  if (city) {
    providerMatch.city = { $regex: `^${escapeRegex(city)}$`, $options: "i" };
  }

  const statusMatch = {};
  if (status) statusMatch["current.acceptingStatus"] = status;
  if (insurance) statusMatch["current.insurances"] = insurance;
  if (telehealth) statusMatch["current.telehealth"] = true;

  const attachCurrent = [
    {
      $lookup: {
        from: "availabilityReports",
        localField: "_id",
        foreignField: "providerId",
        pipeline: [
          { $match: { createdAt: { $gte: outdatedCutoff() } } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { authorId: 0 } },
        ],
        as: "recent",
      },
    },
    { $addFields: { current: { $first: "$recent" } } },
    { $project: { recent: 0 } },
  ];

  const skip = (page - 1) * limit;
  const filtersOnStatus = Object.keys(statusMatch).length > 0;

  const pipeline = filtersOnStatus
    ? [
        { $match: providerMatch },
        ...attachCurrent,
        { $match: statusMatch },
        { $sort: { name: 1 } },
        {
          $facet: {
            items: [{ $skip: skip }, { $limit: limit }],
            total: [{ $count: "count" }],
          },
        },
      ]
    : [
        { $match: providerMatch },
        { $sort: { name: 1 } },
        {
          $facet: {
            items: [{ $skip: skip }, { $limit: limit }, ...attachCurrent],
            total: [{ $count: "count" }],
          },
        },
      ];

  const [result] = await providers().aggregate(pipeline).toArray();
  const total = result.total[0]?.count ?? 0;
  return {
    items: result.items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function getCitySummary(city) {
  const cityMatch = city
    ? { "provider.city": { $regex: `^${escapeRegex(city)}$`, $options: "i" } }
    : {};

  const [summary] = await reports()
    .aggregate([
      { $match: { createdAt: { $gte: outdatedCutoff() } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$providerId",
          latestStatus: { $first: "$acceptingStatus" },
          reportCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "providers",
          localField: "_id",
          foreignField: "_id",
          as: "provider",
        },
      },
      { $unwind: "$provider" },
      { $match: cityMatch },
      {
        $group: {
          _id: null,
          acceptingProviders: {
            $sum: { $cond: [{ $eq: ["$latestStatus", "accepting"] }, 1, 0] },
          },
          providersWithReports: { $sum: 1 },
          reportsUsed: { $sum: "$reportCount" },
        },
      },
    ])
    .toArray();

  return {
    city,
    acceptingProviders: summary?.acceptingProviders ?? 0,
    providersWithReports: summary?.providersWithReports ?? 0,
    reportsUsed: summary?.reportsUsed ?? 0,
  };
}
