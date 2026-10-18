import express from "express";
import { createExperienceReportIndexes } from "./db/experienceReportsDB.js";
import { connectDB } from "./db/myMongoDB.js";
import providersRouter from "./routes/providers.js";
import experienceReportsRouter from "./routes/experienceReports.js";
import { anonymousId } from "./middleware/anonymousId.js";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(anonymousId);
app.use(express.static("frontend"));

app.use("/api/providers", providersRouter);
app.use("/api/experience-reports", experienceReportsRouter);
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl}`, err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({ error: "Something went wrong on the server" });
});

await connectDB();
await createExperienceReportIndexes();

app.listen(PORT, () => {
  console.log(`OpenSlots running on http://localhost:${PORT}`);
});
