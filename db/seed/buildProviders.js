import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const OUTPUT_FILE = new URL("./data/providers.json", import.meta.url);
const STATE = "MA";

const SPECIALTY_KEYWORDS = [
  "PSYCH",
  "SOCIAL WORKER",
  "MENTAL HEALTH COUNSELOR",
  "MARRIAGE AND FAMILY THERAPIST",
];

const COLUMNS = {
  npi: "NPI",
  lastName: "Provider Last Name",
  firstName: "Provider First Name",
  credential: "Cred",
  specialty: "pri_spec",
  city: "City/Town",
  state: "State",
  zip: "ZIP Code",
};

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function indexColumns(header) {
  const index = {};
  for (const [key, name] of Object.entries(COLUMNS)) {
    const position = header.indexOf(name);
    if (position === -1) {
      throw new Error(`Column "${name}" not found in the CSV header`);
    }
    index[key] = position;
  }
  return index;
}

function toTitleCase(text) {
  return text
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (match, sep, letter) => {
      return sep + letter.toUpperCase();
    });
}

function cleanZip(zip) {
  let digits = zip.replace(/\D/g, "");
  if (digits.length === 4 || digits.length === 8) digits = `0${digits}`;
  return digits.slice(0, 5);
}

function isMentalHealth(specialty) {
  return SPECIALTY_KEYWORDS.some((keyword) => specialty.includes(keyword));
}

async function build(inputPath) {
  const lines = createInterface({
    input: createReadStream(inputPath),
    crlfDelay: Infinity,
  });

  let columns;
  let rowsRead = 0;
  const providers = new Map();
  const specialtyCounts = {};

  for await (const line of lines) {
    if (!columns) {
      columns = indexColumns(parseCsvLine(line.replace(/^\uFEFF/, "")));
      continue;
    }
    rowsRead++;

    if (!line.includes(`,${STATE},`)) continue;

    const row = parseCsvLine(line);
    if (row[columns.state] !== STATE) continue;

    const specialty = row[columns.specialty].toUpperCase();
    if (!isMentalHealth(specialty)) continue;

    const npi = row[columns.npi];
    if (!npi || providers.has(npi)) continue;

    const name = `${row[columns.firstName]} ${row[columns.lastName]}`.trim();
    const city = row[columns.city];
    const zip = cleanZip(row[columns.zip]);
    if (!name || !city || zip.length !== 5) continue;

    providers.set(npi, {
      npi,
      name: toTitleCase(name),
      credential: row[columns.credential] || "Not listed",
      specialty: toTitleCase(specialty),
      city: toTitleCase(city),
      state: STATE,
      zip,
    });
    specialtyCounts[specialty] = (specialtyCounts[specialty] || 0) + 1;
  }

  const list = [...providers.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  await writeFile(OUTPUT_FILE, `${JSON.stringify(list, null, 2)}\n`);

  console.log(`Rows read: ${rowsRead}`);
  console.log(`Unique ${STATE} mental health providers: ${list.length}`);
  console.table(specialtyCounts);
  console.log(`Saved to ${fileURLToPath(OUTPUT_FILE)}`);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    'Usage: node db/seed/buildProviders.js "E:/MSCS/Web-Dev/OpenSlots/data/DAC_NationalDownloadableFile.csv"'
  );
  process.exitCode = 1;
} else {
  try {
    await build(inputPath);
  } catch (error) {
    console.error("Build failed:", error.message);
    process.exitCode = 1;
  }
}
