import express from "express";

const app = express();
const PORT = process.env.PORT || 3001;

// Parse incoming JSON request bodies.
app.use(express.json());

// Health check endpoint: proves the container is up and reachable.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "app-template-backend" });
});

app.listen(PORT, () => {
  console.log(`app-template backend listening on http://localhost:${PORT}`);
});