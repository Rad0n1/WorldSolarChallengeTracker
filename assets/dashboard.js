// assets/dashboard.js
import { getText, fmtMB } from './utils.js';

const csvUrl = 'telemetry/alldata-latest.csv';

async function updateDashboard() {
  const btn = document.getElementById('btnRefresh');
  const statusEl = document.getElementById('status');
  try {
    if (btn) btn.disabled = true;
    statusEl.textContent = 'fetching…';

    const res = await fetch(csvUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const blob = await res.blob();
    document.getElementById('csvSize').textContent = fmtMB(blob.size);

    const text = await blob.text();
    const lines = text.trim().split(/\r?\n/);
    const rowCount = Math.max(0, lines.length - 1); // minus header
    document.getElementById('rowCount').textContent = rowCount;

    document.getElementById('lastUpdated').textContent = new Date().toISOString();
    statusEl.textContent = 'live';
    statusEl.className = 'v ok';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'error';
    statusEl.className = 'v err';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// initial + periodic refresh
updateDashboard();
document.getElementById('btnRefresh')?.addEventListener('click', updateDashboard);
setInterval(updateDashboard, 60_000);
