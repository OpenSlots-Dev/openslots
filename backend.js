import express from "express";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.static("frontend"));

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

app.listen(PORT, () => {
  console.log(`OpenSlots running on http://localhost:${PORT}`);
});
