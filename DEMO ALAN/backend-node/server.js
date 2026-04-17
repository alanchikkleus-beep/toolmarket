import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { loadDB, parseInsert, getCompatibility, getHolders, getInsertTypes, searchByHolder } from "./compatibility.js";
import { searchAvito } from "./scraper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 8000;

app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

await loadDB(path.join(__dirname, "..", "backend", "data", "inserts.json"));

// ── API ────────────────────────────────────────────────────────────────────
app.get("/api/ping", (_, res) => res.json({ status: "ok" }));

app.get("/api/market", async (req, res) => {
  const q = req.query.q;
  const limit = Math.min(parseInt(req.query.limit || "24"), 50);
  if (!q) return res.status(400).json({ error: "Параметр q обязателен" });
  const data = await searchAvito(`твердосплавные пластины ${q}`, limit);
  res.json(data);
});

app.get("/api/compatibility/:code", (req, res) => {
  const result = getCompatibility(req.params.code);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.get("/api/holders", (_, res) => res.json(getHolders()));
app.get("/api/insert-types", (_, res) => res.json(getInsertTypes()));

app.get("/api/search-by-holder", (req, res) => {
  const prefix = req.query.prefix || "";
  res.json(searchByHolder(prefix));
});

// ── Static frontend ────────────────────────────────────────────────────────
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));
app.get("*", (_, res) => res.sendFile(path.join(frontendDir, "index.html")));

app.listen(PORT, () => {
  console.log(`\n  ToolMarket Monitor запущен: http://127.0.0.1:${PORT}\n`);
});
