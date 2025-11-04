import { patchFooterStatus } from "https://civic-interconnect.github.io/app-core/index-init.js";
import "../components/ci-footer/ci-footer.js";
import { appState } from "./appState.js";

import {
  fitToCounty,
  initMap,
  loadPrecincts,
  setChoropleth,
} from "./map.js";
import {
  years,
  offices,
  counties,
  getKPIsForPrecinct,
  findPrecinctByName,
} from "./store.js";
import {
  populateMNSenateDistrictSelect,
  populateMNHouseDistrictSelect,
} from "./controllers.js";


function handlePrecinctClick(props) {  
  appState.setSelectedPrecinctId(props.precinct_id);
  renderDetails();
}

function applyView() {
  const state = appState.getState();
  setChoropleth(state.year, state.office, state.metric);
  fitToCounty(state.county, state.mnSenateDistrict, state.mnHouseDistrict);
  renderDetails();
  updateURLHash();
}


function populateOfficeSelect() {
  const sel = document.getElementById("office-select");
  const state = appState.getState();
  
  sel.innerHTML = offices()
    .map((o) => `<option value="${o}">${o.replace("_", " ")}</option>`)
    .join("");
  sel.value = state.office;
  
  sel.addEventListener("change", () => {
    appState.setOffice(sel.value);
    applyView();
  });
}

function renderDetails() {
  const el = document.getElementById("detail-body");
  const state = appState.getState();
  
  if (!state.selectedPrecinctId) {
    el.textContent = "Click a precinct...";
    setKPIs(null);
    return;
  }
  
  const k = getKPIsForPrecinct(
    state.selectedPrecinctId,
    state.year,
    state.office
  );
  setKPIs(k);
  
  el.innerHTML = [
    "<table>",
    `<tr><th>Precinct</th><td>${k.precinct_name}</td></tr>`,
    `<tr><th>County</th><td>${k.county}</td></tr>`,
    `<tr><th>Year</th><td>${state.year}</td></tr>`,
    `<tr><th>Office</th><td>${state.office.replace("_", " ")}</td></tr>`,
    `<tr><th>Registered</th><td>${k.registered}</td></tr>`,
    `<tr><th>Turnout</th><td>${k.turnout_pct.toFixed(1)}%</td></tr>`,
    `<tr><th>DEM</th><td>${k.dem} (${k.dem_share.toFixed(1)}%)</td></tr>`,
    `<tr><th>GOP</th><td>${k.gop} (${k.gop_share.toFixed(1)}%)</td></tr>`,
    `<tr><th>Margin</th><td>${k.margin.toFixed(1)} pts</td></tr>`,
    "</table>",
  ].join("");
}

function setKPIs(k) {
  document.getElementById("kpi-turnout").textContent = k
    ? k.turnout_pct.toFixed(1) + "%"
    : "--";
  document.getElementById("kpi-dem").textContent = k
    ? k.dem_share.toFixed(1) + "%"
    : "--";
  document.getElementById("kpi-gop").textContent = k
    ? k.gop_share.toFixed(1) + "%"
    : "--";
  document.getElementById("kpi-margin").textContent = k
    ? k.margin.toFixed(1)
    : "--";
}
function populateYearSelect() {
  const sel = document.getElementById("year-select");
  sel.innerHTML = years()
    .map((y) => "<option value=\"" + y + "\">" + y + "</option>")
    .join("");
  sel.value = years()[years().length - 1];
  sel.addEventListener("change", () => {
    appState.year = parseInt(sel.value, 10);
    applyView();
  });
}


export function populateCountySelect() {
  const sel = document.getElementById("county-select");
  sel.innerHTML = ["", ...counties()]
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
    
  sel.addEventListener("change", () => {
    appState.setCounty(sel.value || null);
    // Refresh children dropdowns
    populateMNSenateDistrictSelect(appState.getState(), appState.getConfig());
    populateMNHouseDistrictSelect(appState.getState(), appState.getConfig());
    applyView();
  });
}

function populateMNSenateDistrictSelectHandler() {
  const sel = document.getElementById("mn-senate-district-select");
  sel.addEventListener("change", () => {
    appState.setMnSenateDistrict(sel.value || null);
    // Refresh house after senate changes (cascading)
    populateMNHouseDistrictSelect(appState.getState(), appState.getConfig());
    applyView();
  });
}

function wireHouseHandler() {
  const sel = document.getElementById("mn-house-district-select");
  sel.addEventListener("change", () => {
    appState.setMnHouseDistrict(sel.value || null);
    applyView();
  });
}

function wireControls() {
  const metric = document.getElementById("metric-select");
  metric.addEventListener("change", () => {
    appState.setMetric(metric.value);
    applyView();
  });

  const search = document.getElementById("precinct-search");
  search.addEventListener("input", () => {
    const match = findPrecinctByName(search.value);
    if (match) {
      appState.setSelectedPrecinctId(match.precinct_id);
      applyView();
    }
  });
}

function updateURLHash() {
  const state = appState.getState();
  const parts = [];
  if (state.year) parts.push("year=" + state.year);
  if (state.metric) parts.push("metric=" + state.metric);
  if (state.county) parts.push("county=" + encodeURIComponent(state.county));
  if (state.selectedPrecinctId) parts.push("p=" + state.selectedPrecinctId);
  location.hash = parts.join("&");
}

async function main() {
  console.log("[app] Starting main()");
  // 1. Initialize appState (loads UI config and data)
  await appState.initialize();
  
  const state = appState.getState();
  const uiConfig = appState.getConfig();
  const geo = appState.getGeo();
  console.log("AppState initialized.");

  // 2. Initialize filter dropdowns
  populateCountySelect();
  populateMNSenateDistrictSelect(state, uiConfig);
  populateMNHouseDistrictSelect(state, uiConfig);
  console.log("Filters initialized.");

  // 3. Initialize the map and load precinct polygons
  initMap(handlePrecinctClick);
  loadPrecincts(geo);
  console.log("Map initialized.");

  // 4. Populate remaining selects
  populateYearSelect();
  populateOfficeSelect();
  console.log("Selects populated.");

  // 5. Wire handlers for MN Senate + MN House dropdowns
  populateMNSenateDistrictSelectHandler();
  wireHouseHandler();
  console.log("Dropdown handlers wired.");

  // 6. Set defaults for UI and state
  const yearSelect = document.getElementById("year-select");
  const countySelect = document.getElementById("county-select");
  const officeSelect = document.getElementById("office-select");
  const metricSelect = document.getElementById("metric-select");
  const mnSenateDistrictSelect = document.getElementById("mn-senate-district-select");
  const mnHouseDistrictSelect = document.getElementById("mn-house-district-select");

  // --- Default: Year ---
  if ([...yearSelect.options].some((o) => o.value === "2024")) {
    yearSelect.value = "2024";
    appState.setYear(2024);
  } else {
    const fallback = years().slice(-1)[0];
    yearSelect.value = String(fallback);
    appState.setYear(fallback);
  }

  // --- Default: Office + Metric ---
  officeSelect.value = "POTUS";
  appState.setOffice("POTUS");
  metricSelect.value = "margin"; // or "turnout_pct", "dem_share", "gop_share", or "margin"
  appState.setMetric("margin");

  // --- Default: County ---
  for (const opt of countySelect.options) {
    if (opt.text === "St. Louis") {
      countySelect.value = opt.value;
      appState.setCounty(opt.value);
      
      // Update dependent dropdowns immediately
      populateMNSenateDistrictSelect(appState.getState(), appState.getConfig());
      populateMNHouseDistrictSelect(appState.getState(), appState.getConfig());
      break;
    }
  }

  // --- Default: MN Senate District ---
  for (const opt of mnSenateDistrictSelect.options) {
    if (opt.text === "3") {
      mnSenateDistrictSelect.value = opt.value;
      appState.setMnSenateDistrict(opt.value);
      
      // Update MN House dropdown after setting Senate
      populateMNHouseDistrictSelect(appState.getState(), appState.getConfig());
      break;
    }
  }

  // --- Default: MN House District ---
  for (const opt of mnHouseDistrictSelect.options) {
    if (opt.text === "3A") {
      mnHouseDistrictSelect.value = opt.value;
      appState.setMnHouseDistrict(opt.value);
      break;
    }
  }
  console.log("Defaults set:", appState.getState());

  // 7. Wire remaining controls (metric select, search box)
  wireControls();
  console.log("Controls wired.");

  // 8. Patch footer status (version info)
  patchFooterStatus("./VERSION");
  console.log("Footer patched.");

  // 9. Initial map render
  applyView();

  // 10. Expose appState for debugging (instead of just state)
  window.appState = appState;
  console.log("App initialization complete!");
}

// Start the application
main();
