// docs/js/controllers.js - Updated to work with appState

import { availableSenate, availableHouse } from "./filters.js";
import { getMNSenateDistricts, getMNHouseDistricts, geo } from "./store.js";

/**
 * Populate the MN Senate dropdown based on scope rules.
 * @param {object} state - current app state (must include .county and .mnSenateDistrict)
 * @param {object} uiConfig - loaded from ui-config.js (has .filtering and .fields)
 */
export function populateMNSenateDistrictSelect(state, uiConfig) {
  const sel = document.getElementById("mn-senate-district-select");
  if (!sel) return;

  let options;
  if (uiConfig.filtering.mode === "scoped" && state.county) {
    // Pass geo as third parameter to availableSenate
    options = availableSenate({ county: state.county }, uiConfig.fields, geo);
  } else {
    options = getMNSenateDistricts();
  }

  const old = sel.value;
  sel.innerHTML = ["", ...options]
    .map((d) => `<option value="${d}">${d}</option>`)
    .join("");

  // Preserve selection if still valid
  if (uiConfig.filtering.preserve_child_if_still_valid && options.includes(old)) {
    sel.value = old;
    state.mnSenateDistrict = old || null;
  } else if (uiConfig.filtering.auto_select_children && options.length) {
    // Auto-select first option
    sel.value = options[0];
    state.mnSenateDistrict = sel.value;
  } else {
    // Clear selection
    sel.value = "";
    state.mnSenateDistrict = null;
  }
}

/**
 * Populate the MN House dropdown based on scope rules.
 * @param {object} state - current app state (must include .county, .mnSenateDistrict, .mnHouseDistrict)
 * @param {object} uiConfig - loaded from ui-config.js (has .filtering and .fields)
 */
export function populateMNHouseDistrictSelect(state, uiConfig) {
  const sel = document.getElementById("mn-house-district-select");
  if (!sel) return;

  let options;
  if (uiConfig.filtering.mode === "scoped" && (state.county || state.mnSenateDistrict)) {
    // Pass geo as third parameter to availableHouse
    options = availableHouse(
      { county: state.county, mnSenate: state.mnSenateDistrict },
      uiConfig.fields,
      geo
    );
  } else {
    options = getMNHouseDistricts();
  }

  const old = sel.value;
  sel.innerHTML = ["", ...options]
    .map((d) => `<option value="${d}">${d}</option>`)
    .join("");

  // Preserve selection if still valid
  if (uiConfig.filtering.preserve_child_if_still_valid && options.includes(old)) {
    sel.value = old;
    state.mnHouseDistrict = old || null;
  } else if (uiConfig.filtering.auto_select_children && options.length) {
    // Auto-select first option
    sel.value = options[0];
    state.mnHouseDistrict = sel.value;
  } else {
    // Clear selection
    sel.value = "";
    state.mnHouseDistrict = null;
  }
}