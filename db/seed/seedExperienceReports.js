import { createExperienceReportIndexes } from "../experienceReportsDB.js";
import { closeDB, connectDB, getDB } from "../myMongoDB.js";
import { createProviderIndexes, upsertProviders } from "../providersDB.js";

const REPORT_COUNT = 1000;
const PROVIDER_COUNT = 20;

const THERAPY_TYPES = ["Individual", "Couples", "Family", "Group"];
const VISIT_FORMATS = ["In person", "Telehealth", "Hybrid"];
const SPECIALTIES = [
  "Clinical Social Worker",
  "Mental Health Counselor",
  "Clinical Psychologist",
  "Marriage and Family Therapist",
];

function buildDemoProviders() {
  return Array.from({ length: PROVIDER_COUNT }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");

    return {
      npi: `DEMO-EXPERIENCE-${number}`,
      name: `[DEMO] Fictional Therapist ${number}`,
      credential: "Demo",
      specialty: SPECIALTIES[index % SPECIALTIES.length],
      city: "Boston",
      state: "MA",
      zip: "02115",
    };
  });
}

function buildExperienceDate(index) {
  const date = new Date("2025-01-01T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + (index % 600));
  return date;
}

function buildDemoReport(providerIds, index) {
  const reportNumberForProvider = Math.floor(index / providerIds.length);
  const experiencedAt = buildExperienceDate(index);
  const createdAt = new Date(experiencedAt);
  createdAt.setUTCDate(createdAt.getUTCDate() + 7);

  const rating = (reportNumberForProvider % 5) + 1;

  return {
    providerId: providerIds[index % providerIds.length],
    therapyType: THERAPY_TYPES[reportNumberForProvider % THERAPY_TYPES.length],
    visitFormat: VISIT_FORMATS[reportNumberForProvider % VISIT_FORMATS.length],
    rating,
    wouldRecommend: rating >= 4,
    experienceSummary:
      "DEMO DATA: This is a fictional experience report generated for testing.",
    experiencedAt,
    authorId: `demo-experience-${String(index + 1).padStart(4, "0")}`,
    isDemo: true,
    createdAt,
    updatedAt: createdAt,
  };
}

async function seed() {
  await connectDB();
  await createProviderIndexes();
  await createExperienceReportIndexes();

  const demoProviders = buildDemoProviders();
  await upsertProviders(demoProviders);

  const providerRecords = await getDB()
    .collection("providers")
    .find({
      npi: {
        $in: demoProviders.map((provider) => provider.npi),
      },
    })
    .project({ _id: 1, npi: 1 })
    .toArray();

  const providerIdsByNpi = new Map(
    providerRecords.map((provider) => [provider.npi, provider._id])
  );

  const providerIds = demoProviders.map((provider) => {
    const id = providerIdsByNpi.get(provider.npi);

    if (!id) {
      throw new Error(`Demo provider "${provider.npi}" was not created`);
    }

    return id;
  });

  const reports = Array.from({ length: REPORT_COUNT }, (_, index) =>
    buildDemoReport(providerIds, index)
  );

  const result = await getDB()
    .collection("experienceReports")
    .bulkWrite(
      reports.map((report) => ({
        updateOne: {
          filter: { authorId: report.authorId },
          update: { $set: report },
          upsert: true,
        },
      }))
    );

  console.log(
    `Experience reports seeded: ${reports.length} total, ` +
      `${result.upsertedCount} new, ${result.modifiedCount} updated`
  );
  console.log(
    `Demo providers available by searching for "[DEMO]" or "Fictional Therapist".`
  );
}

try {
  await seed();
} catch (error) {
  console.error("Experience report seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
