// docs/js/store.js

let geo = [];
let rows = [];
let byPrecinctYearOffice = new Map();
let metaById = new Map();

export async function loadData() {
  console.log("[store] Starting loadData()");
  console.log("[store] Fetching precinct GeoJSON...");

  // verify paths are correct relative to docs/
  

  geo = await fetch("./data/mn-precincts-web.geojson").then((r) => r.json());
  console.log("[store] Precinct GeoJSON loaded.");
  
  const r2022 = await fetch("./data/election_results_2022.csv")
    .then((r) => r.text())
    .then(csvToRows);
  
  const r2024 = await fetch("./data/election_results_2024.csv")
    .then((r) => r.text())
    .then(csvToRows);
  
  rows = r2022.concat(r2024);

  buildIndex();
  buildMeta(); // derive meta from latest year where available
  publishColorScale();
  console.log("[store] Election data loaded.");
}

function csvToRows(text) {
  const lines = text.trim().split("\n");
  const head = lines.shift().split(",");
  return lines.map((line) => {
    const parts = splitCSV(line);
    const o = {};
    head.forEach((c, i) => (o[c] = parts[i]));
    // coerce numerics
    o.year = Number(o.year);
    o.votes = Number(o.votes || 0);
    o.registered = Number(o.registered || 0);
    o.turnout_eligible = Number(o.turnout_eligible || 0);
    return o;
  });
}

// basic CSV splitter (handles commas without quotes in our files)
function splitCSV(line) {
  return line.split(",");
}

function buildIndex() {
  byPrecinctYearOffice.clear();
  for (const r of rows) {
    const key = r.precinct_id + "|" + r.year + "|" + r.office;
    if (!byPrecinctYearOffice.has(key)) byPrecinctYearOffice.set(key, []);
    byPrecinctYearOffice.get(key).push(r);
  }
}

function buildMeta() {
  // Prefer 2024 names/registered; fall back to 2022
  metaById.clear();
  // iterate in order to let 2024 overwrite 2022
  for (const yr of [2022, 2024]) {
    for (const r of rows.filter((x) => x.year === yr)) {
      metaById.set(r.precinct_id, {
        county: r.county,
        precinct_name: r.precinct_name,
        registered: r.registered,
        turnout_eligible: r.turnout_eligible,
      });
    }
  }
}

export function years() {
  return Array.from(new Set(rows.map((r) => r.year))).sort();
}

export function offices() {
  return Array.from(new Set(rows.map((r) => r.office))).sort();
}

export function counties() {
  const set = new Set(geo.features.map((f) => f.properties.county));
  return Array.from(set).sort();
}

export function getMNSenateDistricts() {
  if (!geo || !geo.features) return [];
  const s = new Set();
  for (const f of geo.features) {
    const v =
      f.properties &&
      (f.properties.mn_senate ||
        f.properties.MNSENDIST ||
        f.properties.mn_senate_district);
    if (v != null && String(v).trim()) s.add(String(v).trim());
  }
  return Array.from(s).sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  );
}

export function getMNHouseDistricts() {
  if (!geo || !geo.features) return [];
  const s = new Set();
  for (const f of geo.features) {
    const v = f.properties && f.properties.mn_house; // your field
    if (v != null && String(v).trim()) s.add(String(v).trim());
  }
  return Array.from(s).sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  );
}

export function getKPIsForPrecinct(pid, year, office) {
  const key = pid + "|" + year + "|" + office;
  const arr = byPrecinctYearOffice.get(key) || [];
  let dem = 0,
    rep = 0,
    oth = 0;
  for (const r of arr) {
    if (r.party === "DEM") dem += r.votes;
    else if (r.party === "REP") rep += r.votes;
    else oth += r.votes;
  }
  const total = dem + rep + oth;
  const meta = metaById.get(pid) || {
    county: "",
    precinct_name: "",
    registered: 0,
    turnout_eligible: 0,
  };
  const reg = meta.registered || 0;
  const turnoutPct = reg ? (total / reg) * 100 : 0;
  return {
    precinct_id: pid,
    precinct_name: meta.precinct_name,
    county: meta.county,
    registered: reg,
    turnout_pct: turnoutPct,
    dem,
    gop: rep,
    oth,
    dem_share: total ? (dem / total) * 100 : 0,
    gop_share: total ? (rep / total) * 100 : 0,
    margin: total ? ((dem - rep) / total) * 100 : 0,
  };
}

export function findPrecinctByName(q) {
  if (!q || q.length < 2) return null;
  const norm = q.toLowerCase();
  for (const f of geo.features) {
    const nm = (f.properties.name || "").toLowerCase();
    if (nm.includes(norm)) return f.properties;
  }
  return null;
}

// returns a function getColor(precinct_id) based on year+office+metric
function colorScaleFactory(year, office, metric) {
  return function (pid) {
    const k = getKPIsForPrecinct(pid, year, office);
    let v = 0;
    if (metric === "turnout_pct") v = k.turnout_pct;
    else if (metric === "dem_share") v = k.dem_share;
    else if (metric === "gop_share") v = k.gop_share;
    else if (metric === "margin") v = k.margin;
    return numericToColor(v, metric);
  };
}

// simple numeric -> color mapping; symmetric for margin, sequential otherwise
function numericToColor(v, metric) {
  if (metric === "margin") {
    if (v > 20) return "#1f78b4";
    if (v > 10) return "#6baed6";
    if (v > 2) return "#9ecae1";
    if (v > -2) return "#cccccc";
    if (v > -10) return "#fcae91";
    if (v > -20) return "#fb6a4a";
    return "#cb181d";
  } else {
    if (v > 70) return "#08519c";
    if (v > 60) return "#2171b5";
    if (v > 50) return "#4292c6";
    if (v > 40) return "#6baed6";
    if (v > 30) return "#9ecae1";
    if (v > 20) return "#c6dbef";
    return "#deebf7";
  }
}

// expose to map.js (which currently expects a global)
function publishColorScale() {
  window.__getColorScale = (year, office, metric) =>
    colorScaleFactory(year, office, metric);
}

export { geo };
