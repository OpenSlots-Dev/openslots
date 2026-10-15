import { Router } from "express";
import {
  findProviders,
  findProviderById,
  listCities,
} from "../db/providersDB.js";

const router = Router();
const MAX_LIMIT = 50;

function toPositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

router.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 20), MAX_LIMIT);

  res.json(await findProviders({ q, city, page, limit }));
});

router.get("/cities", async (req, res) => {
  res.json(await listCities());
});

router.get("/:id", async (req, res) => {
  const provider = await findProviderById(req.params.id);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  res.json(provider);
});

export default router;
