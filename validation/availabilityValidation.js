export const STATUS_OPTIONS = [
  { value: "accepting", label: "Accepting" },
  { value: "waitlist", label: "Waitlist" },
  { value: "not-accepting", label: "Not accepting" },
];

export const ACCEPTING_STATUSES = STATUS_OPTIONS.map((option) => option.value);

export const INSURANCES = [
  "Aetna",
  "Blue Cross Blue Shield",
  "Cigna",
  "Harvard Pilgrim",
  "MassHealth",
  "Medicare",
  "Tufts Health Plan",
  "UnitedHealthcare",
  "Self-pay",
];

export const NOTES_MAX = 300;

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function isValidId(id) {
  return typeof id === "string" && OBJECT_ID_PATTERN.test(id);
}

export function validateReport(body, { requireProvider = true } = {}) {
  const errors = [];
  const value = {};

  if (requireProvider && !isValidId(body.providerId)) {
    errors.push("Choose a provider.");
  }

  if (!ACCEPTING_STATUSES.includes(body.acceptingStatus)) {
    errors.push("Choose Accepting, Waitlist, or Not accepting.");
  } else {
    value.acceptingStatus = body.acceptingStatus;
  }

  if (body.acceptingStatus === "waitlist") {
    const weeks = Number(body.waitlistWeeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
      errors.push("Waitlist length must be a whole number from 1 to 52 weeks.");
    } else {
      value.waitlistWeeks = weeks;
    }
  } else {
    value.waitlistWeeks = null;
  }

  if (
    !Array.isArray(body.insurances) ||
    body.insurances.some((name) => !INSURANCES.includes(name))
  ) {
    errors.push("Choose insurances from the list.");
  } else {
    value.insurances = [...new Set(body.insurances)];
  }

  if (typeof body.telehealth !== "boolean") {
    errors.push("Telehealth must be yes or no.");
  } else {
    value.telehealth = body.telehealth;
  }

  const notes = body.notes ?? "";
  if (typeof notes !== "string") {
    errors.push("Notes must be text.");
  } else if (notes.trim().length > NOTES_MAX) {
    errors.push(`Notes can be at most ${NOTES_MAX} characters.`);
  } else {
    value.notes = notes.trim();
  }

  return { errors, value };
}
