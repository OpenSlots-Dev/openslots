import { readFile } from "node:fs/promises";
import { connectDB, closeDB } from "../myMongoDB.js";
import { createProviderIndexes, upsertProviders } from "../providersDB.js";

const DATA_FILE = new URL("./data/providers.json", import.meta.url);
const REQUIRED_FIELDS = [
  "npi",
  "name",
  "credential",
  "specialty",
  "city",
  "state",
  "zip",
];

function clean(record, index) {
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || String(record[field]).trim() === "") {
      throw new Error(`Record ${index} is missing "${field}"`);
    }
  }
  return {
    npi: String(record.npi).trim(),
    name: String(record.name).trim(),
    credential: String(record.credential).trim(),
    specialty: String(record.specialty).trim(),
    city: String(record.city).trim(),
    state: String(record.state).trim().toUpperCase(),
    zip: String(record.zip).trim().slice(0, 5),
  };
}

async function seed() {
  const raw = await readFile(DATA_FILE, "utf8");
  const records = JSON.parse(raw).map(clean);

  await connectDB();
  await createProviderIndexes();
  const { upserted, modified } = await upsertProviders(records);
  console.log(
    `Providers seeded: ${records.length} read, ${upserted} new, ${modified} updated`
  );
}

try {
  await seed();
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
