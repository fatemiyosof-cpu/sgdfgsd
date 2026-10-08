const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 10000);
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "subscriptions.json");
const PANEL_FILE = path.join(__dirname, "AR.html");

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}", "utf8");

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8") || "{}"); }
  catch { return {}; }
}
function writeDb(db) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE);
}
function id() { return crypto.randomBytes(18).toString("base64url"); }
function baseUrl(req) {
  return (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL ||
    `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}
function normalizeConfigs(configs) {
  if (!Array.isArray(configs)) return [];
  return configs.filter(x => x && typeof x === "object" && typeof x.content === "string")
    .map(x => ({
      name: String(x.name || ""),
      country: String(x.country || ""),
      countryCode: String(x.countryCode || ""),
      data: x.data ?? null,
      days: String(x.days ?? ""),
      content: x.content
    }));
}
function expires(days) {
  const n = Number.parseInt(String(days ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? new Date(Date.now() + n * 86400000).toISOString() : null;
}
function publicSub(s, req) {
  return {
    ok: true,
    subscriptionId: s.id,
    id: s.id,
    url: `${baseUrl(req)}/sub/${encodeURIComponent(s.id)}`,
    panelName: s.panelName,
    profile: s.profile,
    volume: s.volume,
    days: s.days,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    status: s.status,
    configs: s.configs
  };
}

app.get("/health", (req,res) => res.json({ ok:true, service:"ARcodm", subscriptionStorage:"file" }));

app.post("/api/subscriptions", (req,res) => {
  try {
    const b = req.body || {};
    const configs = normalizeConfigs(b.configs);
    if (!configs.length) return res.status(400).json({ ok:false, error:"No valid configs supplied" });

    const db = readDb();
    const existingId = String(b.subscriptionId || "").trim();
    const sid = existingId && db[existingId] ? existingId : id();
    const old = db[sid];

    const days = String(b.days ?? configs[0].days ?? "").trim();
    const item = {
      id: sid,
      panelName: String(b.panelName || b.profile || "").trim(),
      profile: String(b.profile || b.panelName || "").trim(),
      volume: String(b.volume || "").trim(),
      days,
      createdAt: old?.createdAt || new Date().toISOString(),
      expiresAt: expires(days),
      status: "active",
      configs
    };
    db[sid] = item;
    writeDb(db);
    res.json(publicSub(item, req));
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"Subscription save failed" });
  }
});

app.get("/api/subscriptions/:id", (req,res) => {
  const s = readDb()[req.params.id];
  if (!s) return res.status(404).json({ ok:false, error:"Subscription not found" });
  if (s.expiresAt && new Date(s.expiresAt) <= new Date()) {
    s.status = "expired"; s.configs = [];
  }
  res.json(publicSub(s, req));
});

app.delete("/api/subscriptions/:id", (req,res) => {
  const db = readDb(), s = db[req.params.id];
  if (!s) return res.status(404).json({ ok:false, error:"Subscription not found" });
  s.status = "disabled"; s.configs = []; writeDb(db);
  res.json({ ok:true, subscriptionId:s.id, status:"disabled" });
});

app.get("/sub/:id", (req,res) => {
  const s = readDb()[req.params.id];
  if (!s) return res.status(404).type("text/plain").send("Subscription not found");
  if (s.status !== "active" || (s.expiresAt && new Date(s.expiresAt) <= new Date()))
    return res.status(410).type("text/plain").send("Subscription expired or disabled");

  if (req.query.format === "json") {
    return res.json({ ok:true, subscriptionId:s.id, profile:s.profile, expiresAt:s.expiresAt, configs:s.configs });
  }
  const out = s.configs.map(x => x.content).filter(Boolean).join("\n\n");
  res.type("text/plain; charset=utf-8").send(out || "No active configs");
});

// Root panel — no public/ directory.
app.get("/", (req,res) => res.sendFile(PANEL_FILE));
app.get("/AR.html", (req,res) => res.sendFile(PANEL_FILE));

app.use((req,res) => res.status(404).json({ ok:false, error:"not found" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ARcodm running on port ${PORT}`);
});
