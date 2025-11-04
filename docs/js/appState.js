// docs/js/appState.js

import { loadUiConfig } from "./ui-config.js";
import { loadData, geo } from "./store.js";

class AppState {
  constructor() {
    this.uiConfig = null;
    this.geo = null;
    this.state = {
      year: null,
      office: "POTUS",
      metric: "turnout_pct",
      county: null,
      selectedPrecinctId: null,
      mnSenateDistrict: null,
      mnHouseDistrict: null
    };
  }

  async initialize() {
    // Load UI configuration
    this.uiConfig = await loadUiConfig();
    console.log("[appState] UI Config loaded:", this.uiConfig);
    
    // Load precinct and election data
    await loadData();
    this.geo = geo; // geo is exported from store.js after loadData()
    console.log("[appState] Data loaded.");
    
    return this;
  }

  getConfig() { 
    return this.uiConfig; 
  }
  
  getGeo() { 
    return this.geo; 
  }
  
  getState() { 
    return this.state; 
  }

  // Helper methods for state updates
  updateState(updates) {
    Object.assign(this.state, updates);
  }

  setYear(year) {
    this.state.year = year;
  }

  setOffice(office) {
    this.state.office = office;
  }

  setMetric(metric) {
    this.state.metric = metric;
  }

  setCounty(county) {
    this.state.county = county;
  }

  setSelectedPrecinctId(id) {
    this.state.selectedPrecinctId = id;
  }

  setMnSenateDistrict(district) {
    this.state.mnSenateDistrict = district;
  }

  setMnHouseDistrict(district) {
    this.state.mnHouseDistrict = district;
  }
}

// Create singleton instance
export const appState = new AppState();