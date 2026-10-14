import { randomUUID } from "node:crypto";

const COOKIE_NAME = "openslotsId";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readCookie(req, name) {
  const header = req.headers.cookie;

  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function anonymousId(req, res, next) {
  let id = readCookie(req, COOKIE_NAME);

  if (!id || !UUID_PATTERN.test(id)) {
    id = randomUUID();

    res.cookie(COOKIE_NAME, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR_MS,
    });
  }

  req.anonId = id;
  next();
}

export function isOwner(req, document) {
  return Boolean(
    document && document.authorId && document.authorId === req.anonId
  );
}

export function toPublic(req, document) {
  const { authorId, ...publicDocument } = document;

  return {
    ...publicDocument,
    isMine: Boolean(authorId) && authorId === req.anonId,
  };
}
