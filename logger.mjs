// logger.mjs — BWSC KML -> raw snapshot + NDJSON rows (zero deps)
// Node 18+ (uses global fetch)

import { mkdir, writeFile, appendFile, access } from "node:fs/promises";
import { constants as FS } from "node:fs";

const FEED = "https://telemetry.worldsolarchallenge.org/wscearth/latest.kml";

// ---------- helpers ----------
const isoNow = () => new Date().toISOString();
const fileStamp = (iso) => iso.replace(/[:.]/g, "-");             // safe for filenames
const dayOf = (iso) => iso.slice(0, 10);

async function ensureFile(path) {
  try { await access(path, FS.F_OK); }
  catch { await appendFile(path, ""); } // touch
}

// Namespace-tolerant KML parser for <Placemark> (accepts <kml:Placemark> etc.)
function extractPoints(kmlText) {
  const points = [];
  const pmRe = /<([\w:]*Placemark)\b[^>]*>([\s\S]*?)<\/\1>/g;   // capture name, use backref for end tag
  let m;
  while ((m = pmRe.exec(kmlText))) {
    const body = m[2];

    // name (plain <name>…</name>, no namespace expected here)
    const name = (body.match(/<name>([\s\S]*?)<\/name>/)?.[1] || "").trim();
    if (!name) continue;

    // coordinates (any nesting; KML order is lon,lat[,alt])
    const coordM = body.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordM) continue;
    const coord = coordM[1].trim().split(/,\s*/);
    const lon = Number(coord[0]);
    const lat = Number(coord[1]);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ name, lat, lon });
    }
  }
  return points;
}

// ---------- main ----------
async function run() {
  const t0 = Date.now();
  const iso = isoNow();
  const stamp = fileStamp(iso);
  const day = dayOf(iso);

  await mkdir("data/raw", { recursive: true });

  // fetch KML
  const res = await fetch(FEED, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch ${FEED} -> HTTP ${res.status}`);
  const kml = await res.text();

  // quick diagnostics
  const size = kml.length;
  const pmCount = (kml.match(/<[\w:]*Placemark\b/g) || []).length;
  console.log(`KML bytes: ${size}`);
  console.log(`Placemark tags seen: ${pmCount}`);

  // save raw snapshot
  const rawPath = `data/raw/${stamp}.kml`;
  await writeFile(rawPath, kml, "utf8");
  console.log(`Saved raw snapshot: ${rawPath}`);

  // parse + append NDJSON
  const rowsPath = `data/day-${day}.ndjson`;
  await ensureFile(rowsPath);

  const points = extractPoints(kml);
  console.log(`Parsed points: ${points.length}`);
  if (points.length) {
    const preview = points.slice(0, 3).map(p => ({ team: p.name, lat: p.lat, lon: p.lon }));
    console.log(`First points:`, preview);
  }

  let appended = 0;
  for (const p of points) {
    const row = { ts_fetch: iso, team: p.name, lat: p.lat, lon: p.lon, src: "bwsc_kml" };
    await appendFile(rowsPath, JSON.stringify(row) + "\n", "utf8");
    appended++;
  }
  console.log(`Appended ${appended} rows -> ${rowsPath}`);

  const dt = Date.now() - t0;
  console.log(`Done in ${dt} ms at ${iso}`);
}

run().catch(err => { console.error("LOGGER ERROR:", err); process.exit(1); });
