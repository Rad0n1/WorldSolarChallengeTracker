import { writeFile, mkdir, appendFile } from "node:fs/promises";
import { parseStringPromise } from "xml2js";

const FEED = "https://telemetry.worldsolarchallenge.org/wscearth/latest.kml";
const now = new Date();
const iso = now.toISOString();
const stamp = iso.replace(/[:.]/g, "-");
await mkdir("data/raw", { recursive: true });

const res = await fetch(FEED, { cache: "no-store" });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const kml = await res.text();

// snapshot KML
await writeFile(`data/raw/${stamp}.kml`, kml, "utf8");

// normalize to NDJSON (one row per team)
const xml = await parseStringPromise(kml);
const pms = xml?.kml?.Document?.[0]?.Placemark ?? [];
let rows = 0;
for (const pm of pms) {
  const name = (pm?.name?.[0] ?? "").trim();
  const coords = pm?.Point?.[0]?.coordinates?.[0] ?? "";
  const [lon, lat] = coords.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const row = { ts_fetch: iso, team: name, lat, lon, src: "bwsc_kml" };
  await appendFile(`data/day-${iso.slice(0,10)}.ndjson`, JSON.stringify(row) + "\n");
  rows++;
}
console.log(`Wrote ${rows} points at ${iso}`);