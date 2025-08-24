// assets/scrubber.js
import {
  getJSON, haversineKm, nearestIdx, quantize5min, formatUTC
} from './utils.js';

const indexUrl = 'public/teams/index.json';
const teamBase = 'public/teams';

const state = {
  teams: {},   // key -> { label, series: [{t,lat,lon}], cum: [km] }
  tmin: null,
  tmax: null,
};

async function loadTeams() {
  const statusEl = document.getElementById('status');
  try {
    const index = await getJSON(indexUrl);
    const keys = Object.keys(index);

    await Promise.all(keys.map(async key => {
      const dir = (index[key] && index[key].dir) ? index[key].dir : key
      const url = `${teamBase}/${encodeURIComponent(dir)}/timeseries.json`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return; // skip missing
      const arr = await r.json();

      const series = arr
        .map(d => ({ t: Date.parse(d.ts), lat: d.lat, lon: d.lon }))
        .sort((a, b) => a.t - b.t);

      const cum = new Array(series.length).fill(0);
      for (let i = 1; i < series.length; i++) {
        const a = series[i - 1], b = series[i];
        cum[i] = cum[i - 1] + haversineKm(a.lat, a.lon, b.lat, b.lon);
      }

      if ((index[key].class || '').toLowerCase() !== 'challenger') return;
      
      state.teams[key] = { label: index[key].team || key, series, cum };

      if (series.length) {
        const t0 = series[0].t, t1 = series[series.length - 1].t;
        state.tmin = state.tmin == null ? t0 : Math.min(state.tmin, t0);
        state.tmax = state.tmax == null ? t1 : Math.max(state.tmax, t1);
      }
    }));

    setupScrubber();
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'error';
    statusEl.className = 'v err';
  }
}

function setupScrubber() {
  const s = document.getElementById('scrubber');
  const timeEl = document.getElementById('scrubTime');
  if (!s) return;

  if (state.tmin == null || state.tmax == null || state.tmin >= state.tmax) {
    s.disabled = true;
    timeEl.textContent = '—';
    return;
  }

  s.min = String(state.tmin);
  s.max = String(state.tmax);
  s.step = String(5 * 60 * 1000); // 5 minutes in ms
  s.value = String(state.tmax);

  const qt = quantize5min(Number(s.value));
  s.value = String(qt);
  updateLeaderboard(qt);

  s.addEventListener('input', () => {
    const q = quantize5min(Number(s.value));
    s.value = String(q);
    updateLeaderboard(q);
  });
}

function updateLeaderboard(targetMs) {
  const timeEl = document.getElementById('scrubTime');
  const lb = document.getElementById('leaderboard');
  const leaderKeyEl = document.getElementById('leaderKey');

  timeEl.textContent = formatUTC(targetMs);

  const ranks = [];
  for (const [key, obj] of Object.entries(state.teams)) {
    const { series, cum } = obj;
    if (!series.length) continue;
    const idx = nearestIdx(series, targetMs);
    if (idx < 0) continue;
    ranks.push({ key, dist: cum[idx] });
  }
  ranks.sort((a, b) => b.dist - a.dist);

  lb.innerHTML = '';
  for (const r of ranks.splice(0, 10)) {
    const li = document.createElement('li');
    const km = (r.dist).toFixed(2);
    const label = state.teams[r.key].label || r.key;
    li.textContent = `${r.key} — ${label} — ${km} km`;
    lb.appendChild(li);
  }
  leaderKeyEl.textContent = ranks.length ? ranks[0].key : '—';
}

// kick it off
loadTeams();
