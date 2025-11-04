export async function loadUiConfig() {
  const defaults = {
    filtering: {
      mode: "scoped",
      precedence: ["county", "mn_senate", "mn_house"],
      auto_select_children: true,
      preserve_child_if_still_valid: true
    },
    fields: { county: "county", senate: "mn_senate", house: "mn_house" }
  };
  try {
    const res = await fetch("./js/ui-config.json"); // path relative to docs/
    console.log("Fetched UI config from ./js/ui-config.json");
    if (!res.ok) return defaults;
    const cfg = await res.json();
    return {
      filtering: { ...defaults.filtering, ...(cfg.filtering || {}) },
      fields: { ...defaults.fields, ...(cfg.fields || {}) }
    };
  } catch {
    return defaults;
  }
}
