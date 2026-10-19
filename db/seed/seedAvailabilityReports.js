import { closeDB, connectDB, getDB } from "../myMongoDB.js";
import { createProviderIndexes, upsertProviders } from "../providersDB.js";
import {
  createAvailabilityIndexes,
  outdatedCutoff,
} from "../availabilityReportsDB.js";
import {
  INSURANCES,
  validateReport,
} from "../../validation/availabilityValidation.js";

const REPORT_COUNT = 1000;
const SPREAD_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const SPECIALTIES = [
  "Clinical Social Worker",
  "Mental Health Counselor",
  "Clinical Psychologist",
  "Marriage and Family Therapist",
];

const CITIES = [
  { city: "Cambridge", zip: "02139" },
  { city: "Somerville", zip: "02143" },
  { city: "Newton", zip: "02458" },
  { city: "Worcester", zip: "01608" },
  { city: "Springfield", zip: "01103" },
];

const DEMO_NOTES = [
  "DEMO DATA: Front desk confirmed by phone.",
  "DEMO DATA: Intake coordinator returned my call.",
  "DEMO DATA: Online booking page showed open slots.",
  "DEMO DATA: Asked to call back next month.",
];

function createRandom(seed) {
  let state = seed;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(5610);

function pick(list) {
  return list[Math.floor(random() * list.length)];
}

function pickSome(list, min, max) {
  const count = min + Math.floor(random() * (max - min + 1));
  return [...list].sort(() => random() - 0.5).slice(0, count);
}

function buildAvailabilityDemoProviders() {
  return Array.from({ length: 20 }, (_, index) => {
    const place = CITIES[index % CITIES.length];
    return {
      npi: `DEMO-AVAILABILITY-${String(index + 1).padStart(2, "0")}`,
      name: `[DEMO] Fictional Therapist ${index + 21}`,
      credential: "Demo",
      specialty: SPECIALTIES[index % SPECIALTIES.length],
      city: place.city,
      state: "MA",
      zip: place.zip,
    };
  });
}

function pickStatus() {
  const roll = random();
  if (roll < 0.4) return "accepting";
  if (roll < 0.75) return "waitlist";
  return "not-accepting";
}

function buildDemoReport(provider, index, now) {
  const acceptingStatus = pickStatus();
  const input = {
    providerId: provider._id.toHexString(),
    acceptingStatus,
    waitlistWeeks:
      acceptingStatus === "waitlist" ? 1 + Math.floor(random() * 16) : null,
    insurances: pickSome(INSURANCES, 1, 4),
    telehealth: random() < 0.6,
    notes: random() < 0.3 ? pick(DEMO_NOTES) : "",
  };

  const { errors, value } = validateReport(input);
  if (errors.length > 0) {
    throw new Error(`Demo report ${index + 1} is invalid: ${errors.join(" ")}`);
  }

  const daysAgo = index % SPREAD_DAYS;
  const createdAt = new Date(
    now.getTime() - daysAgo * DAY_MS - (index % 24) * HOUR_MS - 60 * 1000
  );

  return {
    providerId: provider._id,
    ...value,
    authorId: `demo-availability-${String(index + 1).padStart(4, "0")}`,
    isDemo: true,
    createdAt,
    updatedAt: createdAt,
  };
}

async function seed() {
  await connectDB();
  await createProviderIndexes();
  await createAvailabilityIndexes();

  await upsertProviders(buildAvailabilityDemoProviders());

  const demoProviders = await getDB()
    .collection("providers")
    .find({ npi: { $regex: "^DEMO-(EXPERIENCE|AVAILABILITY)-" } })
    .project({ _id: 1, npi: 1, city: 1 })
    .sort({ npi: 1 })
    .toArray();

  if (demoProviders.length === 0) {
    throw new Error("No demo providers found.");
  }

  const now = new Date();
  const reports = Array.from({ length: REPORT_COUNT }, (_, index) =>
    buildDemoReport(demoProviders[index % demoProviders.length], index, now)
  );

  const result = await getDB()
    .collection("availabilityReports")
    .bulkWrite(
      reports.map((report) => ({
        updateOne: {
          filter: { authorId: report.authorId, isDemo: true },
          update: { $set: report },
          upsert: true,
        },
      }))
    );

  const cutoff = outdatedCutoff(now);
  const recent = reports.filter((report) => report.createdAt >= cutoff).length;
  const cities = [...new Set(demoProviders.map((provider) => provider.city))];

  console.log(
    `Availability reports seeded: ${reports.length} total, ` +
      `${result.upsertedCount} new, ${result.modifiedCount} updated`
  );
  console.log(
    `Recent (last 30 days): ${recent}, outdated: ${reports.length - recent}`
  );
  console.log(
    `Demo providers used: ${demoProviders.length} (${cities.join(", ")})`
  );
}

try {
  await seed();
} catch (error) {
  console.error("Availability report seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
