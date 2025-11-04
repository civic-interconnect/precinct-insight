// docs/js/store.js 

let geo = null; // Changed from [] to null for clarity
let rows = [];
let byPrecinctYearOffice = new Map();
let metaById = new Map();

// Add loading status tracking
let loadingStatus = {
  geo: false,
  elections: false,
  error: null
};

export async function loadData() {
  console.log("[store] Starting loadData()");
  
  try {
    // Load GeoJSON with timeout and progress tracking
    await loadGeoJSON();
    
    // Load election data in parallel
    await loadElectionData();
    
    // Build indexes
    buildIndex();
    buildMeta();
    publishColorScale();
    
    console.log("[store] All data loaded successfully");
    console.log(`[store] Total features: ${geo?.features?.length || 0}`);
    console.log(`[store] Total election rows: ${rows.length}`);
    
  } catch (error) {
    console.error("[store] Error loading data:", error);
    loadingStatus.error = error;
    throw error;
  }
}

async function loadGeoJSON() {
  console.log("[store] Fetching precinct GeoJSON...");
  loadingStatus.geo = false;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch("./data/mn-precincts-web.geojson", {
      signal: controller.signal
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load GeoJSON: ${response.status} ${response.statusText}`);
    }
    
    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(2);
      console.log(`[store] GeoJSON size: ${sizeMB} MB`);
      
      // Warn if file is very large
      if (parseInt(contentLength) > 20 * 1024 * 1024) {
        console.warn("[store] ⚠️ Large GeoJSON file detected. Consider using simplified geometries.");
      }
    }
    
    // Parse JSON with error handling
    const text = await response.text();
    console.log(`[store] Downloaded ${(text.length / 1024 / 1024).toFixed(2)} MB of text`);
    
    console.log("[store] Parsing GeoJSON...");
    geo = JSON.parse(text);
    
    // Validate GeoJSON structure
    if (!geo || !geo.features || !Array.isArray(geo.features)) {
      throw new Error("Invalid GeoJSON structure");
    }
    
    console.log(`[store] ✅ GeoJSON loaded: ${geo.features.length} features`);
    
    // Add indices to features for faster lookups
    geo.features.forEach((feature, idx) => {
      if (feature.properties) {
        feature.properties._index = idx;
      }
    });
    
    loadingStatus.geo = true;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('GeoJSON loading timeout - file may be too large');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadElectionData() {
  console.log("[store] Loading election data...");
  loadingStatus.elections = false;
  
  try {
    // Load both years in parallel
    const [r2022, r2024] = await Promise.all([
      fetch("./data/election_results_2022.csv")
        .then(r => {
          if (!r.ok) throw new Error(`Failed to load 2022 data: ${r.status}`);
          return r.text();
        })
        .then(csvToRows),
      fetch("./data/election_results_2024.csv")
        .then(r => {
          if (!r.ok) throw new Error(`Failed to load 2024 data: ${r.status}`);
          return r.text();
        })
        .then(csvToRows)
    ]);
    
    rows = r2022.concat(r2024);
    console.log(`[store] ✅ Election data loaded: ${rows.length} rows`);
    loadingStatus.elections = true;
    
  } catch (error) {
    console.error("[store] Error loading election data:", error);
    throw error;
  }
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
  console.log("[store] Building indices...");
  byPrecinctYearOffice.clear();
  for (const r of rows) {
    const key = r.precinct_id + "|" + r.year + "|" + r.office;
    if (!byPrecinctYearOffice.has(key)) byPrecinctYearOffice.set(key, []);
    byPrecinctYearOffice.get(key).push(r);
  }
  console.log(`[store] Indexed ${byPrecinctYearOffice.size} precinct-year-office combinations`);
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
  console.log(`[store] Built metadata for ${metaById.size} precincts`);
}

export function years() {
  return Array.from(new Set(rows.map((r) => r.year))).sort();
}

export function offices() {
  return Array.from(new Set(rows.map((r) => r.office))).sort();
}

export function counties() {
  if (!geo || !geo.features) return [];
  const set = new Set(geo.features.map((f) => f.properties?.county).filter(Boolean));
  return Array.from(set).sort();
}

export function getMNSenateDistricts() {
  if (!geo || !geo.features) return [];
  const s = new Set();
  for (const f of geo.features) {
    // Check multiple possible field names
    const v = f.properties && (
      f.properties.mn_senate ||
      f.properties.MNSENDIST ||
      f.properties.mn_senate_district ||
      f.properties.senate_district
    );
    if (v != null && String(v).trim()) {
      s.add(String(v).trim());
    }
  }
  return Array.from(s).sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  );
}

export function getMNHouseDistricts() {
  if (!geo || !geo.features) return [];
  const s = new Set();
  for (const f of geo.features) {
    // Check multiple possible field names
    const v = f.properties && (
      f.properties.mn_house ||
      f.properties.MNLEGDIST ||
      f.properties.mn_house_district ||
      f.properties.house_district
    );
    if (v != null && String(v).trim()) {
      s.add(String(v).trim());
    }
  }
  return Array.from(s).sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  );
}

export function getKPIsForPrecinct(pid, year, office) {
  const key = pid + "|" + year + "|" + office;
  const arr = byPrecinctYearOffice.get(key) || [];
  let dem = 0, rep = 0, oth = 0;
  
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
  if (!q || q.length < 2 || !geo || !geo.features) return null;
  const norm = q.toLowerCase();
  for (const f of geo.features) {
    const nm = (f.properties?.name || f.properties?.precinct_name || "").toLowerCase();
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

// Export loading status for debugging
export function getLoadingStatus() {
  return loadingStatus;
}

export { geo };