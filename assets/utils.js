// assets/utils.js

export async function getText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.text();
}

export async function getJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

export function fmtMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

export function formatUTC(ms) {
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

export function quantize5min(ms) {
  const step = 5 * 60 * 1000;
  return Math.round(ms / step) * step;
}

// Haversine distance in km
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

// binary search nearest index by time (ms)
export function nearestIdx(series, targetMs) {
  let lo = 0, hi = series.length - 1;
  if (hi < 0) return -1;
  if (targetMs <= series[0].t) return 0;
  if (targetMs >= series[hi].t) return hi;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = series[mid].t;
    if (t === targetMs) return mid;
    if (t < targetMs) lo = mid + 1; else hi = mid - 1;
  }
  const a = series[lo - 1], b = series[lo];
  return targetMs - a.t <= b.t - targetMs ? (lo - 1) : lo;
}
