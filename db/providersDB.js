import { ObjectId } from "mongodb";
import { getDB } from "./myMongoDB.js";

const COLLECTION = "providers";

function providers() {
  return getDB().collection(COLLECTION);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createProviderIndexes() {
  await providers().createIndexes([
    { key: { npi: 1 }, unique: true },
    { key: { city: 1, name: 1 } },
    { key: { name: 1 } },
  ]);
}

export async function findProviders({ q, city, page = 1, limit = 20 }) {
  const filter = {};
  if (q) filter.name = { $regex: escapeRegex(q), $options: "i" };
  if (city) filter.city = { $regex: `^${escapeRegex(city)}$`, $options: "i" };

  const [items, total] = await Promise.all([
    providers()
      .find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    providers().countDocuments(filter),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function findProviderById(id) {
  if (!ObjectId.isValid(id)) return null;
  return providers().findOne({ _id: new ObjectId(id) });
}

export async function providerExists(id) {
  if (!ObjectId.isValid(id)) return false;
  const count = await providers().countDocuments(
    { _id: new ObjectId(id) },
    { limit: 1 }
  );
  return count === 1;
}

export async function listCities() {
  const cities = await providers().distinct("city");
  return cities.sort((a, b) => a.localeCompare(b));
}

export async function upsertProviders(list) {
  if (list.length === 0) return { upserted: 0, modified: 0 };
  const result = await providers().bulkWrite(
    list.map((provider) => ({
      updateOne: {
        filter: { npi: provider.npi },
        update: { $set: provider },
        upsert: true,
      },
    }))
  );
  return { upserted: result.upsertedCount, modified: result.modifiedCount };
}
