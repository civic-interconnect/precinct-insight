// docs/js/filters.js - Updated to accept geo as parameter

function norm(v) {
  return v == null ? null : String(v).trim().toLowerCase();
}

/**
 * Return the list of MN Senate districts available under the current scope.
 * @param {{ county: string|null }} scope
 * @param {{ county: string, senate: string, house: string }} fields
 * @param {object} geo - GeoJSON object with features
 */
export function availableSenate(scope, fields, geo) {
  const { county } = scope || {};
  const wantCounty = norm(county);
  const set = new Set();
  const feats = geo?.features || [];
  
  for (const f of feats) {
    const p = f?.properties || {};
    const cty = norm(p[fields.county]);
    const sen = p[fields.senate];
    if (!sen) continue;
    if (!wantCounty || (cty && cty === wantCounty)) {
      set.add(String(sen).trim());
    }
  }
  
  return Array.from(set).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

/**
 * Return the list of MN House districts available under the current scope.
 * @param {{ county: string|null, mnSenate: string|null }} scope
 * @param {{ county: string, senate: string, house: string }} fields
 * @param {object} geo - GeoJSON object with features
 */
export function availableHouse(scope, fields, geo) {
  const { county, mnSenate } = scope || {};
  const wantCounty = norm(county);
  const wantSen = norm(mnSenate);
  const set = new Set();
  const feats = geo?.features || [];
  
  for (const f of feats) {
    const p = f?.properties || {};
    const cty = norm(p[fields.county]);
    const sen = norm(p[fields.senate]);
    const house = p[fields.house];
    if (!house) continue;
    
    const countyOk = !wantCounty || (cty && cty === wantCounty);
    const senateOk = !wantSen || (sen && sen === wantSen);
    
    if (countyOk && senateOk) {
      set.add(String(house).trim());
    }
  }
  
  return Array.from(set).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}