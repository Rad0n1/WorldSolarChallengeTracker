// logger.mjs — pulls BWSC latest.kml, saves a raw snapshot,
// and appends tidy rows (ts, team, lat, lon) to a daily NDJSON.
// Always creates the NDJSON (even if 0 placemarks parsed).

import { mkdir, writeFile, appendFile, access } from "node:fs/promises";
import { constants as FS } from "node:fs";

const FEED = "https://telemetry.worldsolarchallenge.org/wscearth/latest.kml";

function isoNow() { return new Date().toISOString(); }
function stampForFile(ts) { return ts.replace(/[:.]/g, "-"); }

function extractPoints(kmlText) {
  const out = [];
  const placemarkRe = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/g;
  let pm;
  while ((pm = placemarkRe.exec(kmlText))) {
    const block = pm[1];
    const name = (block.match(/<name>([\s\S]*?)<\/name>/)?.[1] || "").trim();
    const coord = block.match(/<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/);
    if (!coord) continue;
    const [lonStr, latStr] = coord[1].trim().split(","); // KML order: lon,lat[,alt]
    const lon = Number(lonStr), lat = Number(latStr);
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ name, lat, lon });
  }
  return out;
}

async function ensureFile(path) {
  try { await access(path, FS.F_OK); }
  catch { await appendFile(path, ""); } // touch
}

async function run() {
  const ts = isoNow();
  const day = ts.slice(0, 10);
  const fileStamp = stampForFile(ts);

  // Ensure dirs
  await mkdir("data/raw", { recursive: true });

  // Fetch KML
  const res = await fetch(FEED, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const kml = await res.text();

  // Save raw snapshot
  const rawPath = `data/raw/${fileStamp}.kml`;
  await writeFile(rawPath, kml, "utf8");

  // Parse & write NDJSON
  const ndjsonPath = `data/day-${day}.ndjson`;
  await ensureFile(ndjsonPath); // make sure the file exists even if 0 rows

  const points = extractPoints(kml);
  let wrote = 0;
  for (const p of points) {
    const row = { ts_fetch: ts, team: p.name, lat: p.lat, lon: p.lon, src: "bwsc_kml" };
    await appendFile(ndjsonPath, JSON.stringify(row) + "\n");
    wrote++;
  }

  console.log(`Saved ${rawPath}`);
  console.log(`Appended ${wrote} rows to ${ndjsonPath} at ${ts}`);
}

run().catch(err => { console.error(err); process.exit(1); });
