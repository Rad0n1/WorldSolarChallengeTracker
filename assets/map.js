

async function loadData(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`)
    return res.json();
}

async function loadManifest(){
    let man = await loadData('public/teams/index.json')

    const defs = Object.entries(man).map(([key, v]) => ({
        id: String(key),
        name: String(v.shortname ?? key),
        dir: String(v.dir)
    }));
    return defs
}

let entriesByTeam = new Map();
let timeline = [];

function toMs(x){
    if (typeof x === 'number') return x < 1e11 ? x * 1000 : x; // sec -> ms
    return new Date(x).getTime();
}

async function loadEntriesFor(defs){
    const allTimes = [];

    const results = await Promise.all(defs.map(async (t) => {
        const url = `public/teams/${encodeURIComponent(t.dir)}/timeseries.json`;
        try{
            const teamEntriesLoad = await loadData(url);

            const teamEntries = teamEntriesLoad.map(e => ({
                t: toMs(e.ts),
                lon: Number(e.lon),
                lat: Number(e.lat)
            })).filter(e => isFinite(e.t) && isFinite(e.lon) && isFinite(e.lat));

            teamEntries.sort((a,b) => a.t - b.t);
            const entryTimes = teamEntries.map(e => e.t);
            const entryCoords = teamEntries.map(e => [e.lon, e.lat]);
            if(entryTimes.length){
                entriesByTeam.set(t.id, {times: entryTimes, coords: entryCoords});
                allTimes.push(...entryTimes);
            }
        } catch(e){
            console.warn('Skipping team (load error):', t, e);
        }
    }));

    timeline = Array.from(new Set(allTimes)).sort((a,b) => a-b);
}

let map, teamSource;

function initMap(){
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
                osm: {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© OpenStreetMap contributors'
                }
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        center: [133, -23],
        zoom: 3
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () =>{
        const b = new maplibregl.LngLatBounds();
        for (const {coords} of entriesByTeam.values()) for (const c of coords) b.extend(c);
        if(!b.isEmpty()) map.fitBounds(b, {padding: 40, maxZoom: 15});


        map.addSource('teams', {type: 'geojson', data: {type: 'FeatureCollection', features: [] } });
        teamSource = map.getSource('teams');

        map.addLayer({
            id: 'teams-dot',
            type: 'circle',
            source: 'teams',
            paint: {
                'circle-radius': 8,
                'circle-color': '#f30404ff',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#000000ff'
            }
        });

        map.addLayer({
            id: 'team-labels',
            type: 'symbol',
            source: 'teams',
            layout: {
                'text-field': ['get', 'teamId'],
                'text-size': 12,
                'text-offset': [0, 1.2],
                'text-anchor': 'bottom'
            },
            paint: {
                'text-color': '#000000ff',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.2
            }
        });

        // Selected circle layer ABOVE 'teams-dot'
        map.addLayer({
            id: 'teams-dot-selected',
            type: 'circle',
            source: 'teams',
            filter: ['==', ['get','teamId'], '__none__'], // placeholder, updated later
            paint: {
                'circle-radius': 10,
                'circle-color': '#10b981',       // green
                'circle-stroke-color': '#064e3b',
                'circle-stroke-width': 2
            }
        });

        // Selected label layer ABOVE 'team-labels'
        map.addLayer({
            id: 'team-labels-selected',
            type: 'symbol',
            source: 'teams',
            filter: ['==', ['get','teamId'], '__none__'],
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Regular','Noto Sans Regular'],
                'text-size': 12,
                'text-offset': [0, 1.6],
                'text-anchor': 'bottom',
                'text-allow-overlap': true   // ensure it renders even if others collide
            },
            paint: {
                'text-color': '#10b981',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.2
            }
        });

        initSlider();
        updateSelectedStyling();
        renderSnapshot(0);

        map.resize();
    });
}

function rightmostLE(arr, x){
    let lo = 0, hi = arr.length - 1, ans = -1;
    while(lo <= hi){
        const mid = (lo + hi) >> 1;
        if(arr[mid] <= x) { ans = mid; lo = mid + 1; } else {hi = mid - 1;}
    }
    return ans;
}

const STALE_MS = Infinity;

function renderSnapshot(i){
    const T = timeline[i];
    const features = [];

    for ( const[teamId, {times, coords}] of entriesByTeam.entries()){
        const j = rightmostLE(times, T);
        if (j === -1) continue;
        if(T - times[j] > STALE_MS) continue;

        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coords[j] },
            properties: { teamId, t: times[j]}
        });
    }

    teamSource.setData({type: 'FeatureCollection', features});
}

function initSlider() {
  const slider = document.getElementById('slider');
  const clock  = document.getElementById('clock');

  slider.min = 0;
  slider.max = String(timeline.length - 1);
  slider.value = '0';
  slider.step = '1';

  const update = () => {
    const i = Number(slider.value);
    clock.textContent = new Date(timeline[i]).toLocaleString();
    renderSnapshot(i);
  }

  slider.addEventListener('input', update);
  update();
}

let selectedTeamId = 'Top Dutch'; // or a default id

function renderTeamRadios(defs) {
  const wrap = document.getElementById('team-filter');
  wrap.innerHTML = '';
  wrap.setAttribute('role', 'radiogroup');
  wrap.setAttribute('aria-label', 'Select team');

  // sort alphabetically by display name (case-insensitive)
  const sorted = [...defs].sort((a, b) =>
    (a.name || a.id).localeCompare(b.name || b.id, undefined, { sensitivity: 'base' })
  );

  const make = (id, name) => {
    const label = document.createElement('label');
    label.className = 'team-option';
    label.title = name;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'teamPick';
    input.value = id;
    input.checked = (id === selectedTeamId);

    input.addEventListener('change', () => {
      selectedTeamId = id;
      updateSelectedStyling();
    });

    const text = document.createElement('span');
    text.textContent = name;

    label.appendChild(input);
    label.appendChild(text);
    return label;
  };

  // “None” option to clear selection
  wrap.appendChild(make('', 'None'));

  for (const d of sorted) {
    wrap.appendChild(make(d.id, d.name || d.id));
  }
}

function circlePaintExpression(selectedId) {
    const normalColorMatch = '#ff0000ff'

  if (!selectedId) {
    // No selection: everyone uses normal colors
    return normalColorMatch;
  }

  // Selected team -> green, others -> normal colors (or make them gray if you prefer)
  return [
    'case',
    ['==', ['get', 'teamId'], selectedId], '#00ff15ff',  // selected = green
    normalColorMatch                                   // others = original color map
  ];
}

function updateSelectedStyling() {
  // Update circle color
  map.setPaintProperty('teams-dot', 'circle-color', circlePaintExpression(selectedTeamId));
  // (Optional) bump selected dot size:
  map.setPaintProperty('teams-dot', 'circle-radius', [
    'case',
    ['==', ['get','teamId'], selectedTeamId], 10,
    8
  ]);

  map.setFilter('teams-dot-selected', ['==', ['get','teamId'], selectedTeamId]);
  map.setFilter('team-labels-selected', ['==', ['get','teamId'], selectedTeamId]);
}

(async function main() {
  const defs = await loadManifest();
  await loadEntriesFor(defs);
  initMap();
  renderTeamRadios(defs);
})();