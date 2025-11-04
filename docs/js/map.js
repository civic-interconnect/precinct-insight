// docs/js/map.js

let map,
  precinctLayer,
  featureIndex,
  onClickFeatureCb,
  currentPaint = { fill: "#bbb", stroke: "#666" };

export function initMap(onClickFeature) {
  onClickFeatureCb = onClickFeature;
  map = L.map("map", { preferCanvas: true }).setView([47.5, -92.5], 6);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "&copy; OpenStreetMap & CARTO",
    }
  ).addTo(map);
}

export function loadPrecincts(geojson, getStyle = () => ({})) {
  if (precinctLayer) precinctLayer.remove();

  precinctLayer = L.geoJSON(geojson, {
    style: getStyle,
    onEachFeature: (feature, layer) => {
      // click + hover behavior
      layer.on("click", handleMapClick);
      layer.on("mouseover", () => layer.setStyle({ weight: 2 }));
      layer.on("mouseout", () => layer.setStyle({ weight: 0.5 }));
    },
  }).addTo(map);

  indexFeatures(geojson);
}

function indexFeatures(geojson) {
  featureIndex = {};
  geojson.features.forEach((f) => {
    featureIndex[f.properties.precinct_id] = f;
  });
}

export function setChoropleth(year, office, metric) {
  if (!precinctLayer) return;
  const factory = window.__getColorScale;
  if (typeof factory !== "function") return;

  const getColorFor = factory(year, office, metric);
  precinctLayer.setStyle(function (feature) {
    const props = feature.properties || {};
    const pid = props.precinct_id || props.VTDID || props.vtdid;
    const fill = pid ? getColorFor(pid) : "#cccccc";
    return { color: "#ffffff", weight: 0.5, fillColor: fill, fillOpacity: 0.8 };
  });
}

/** Show only precincts that match all selected filters */
export function fitToCounty(
  county,
  mnSenateDistrict = null,
  mnHouseDistrict = null
) {
  if (!precinctLayer) return;

  const norm = (v) => (v == null ? null : String(v).trim().toLowerCase());
  const wantCounty = norm(county);
  const wantSen = norm(mnSenateDistrict);
  const wantHouse = norm(mnHouseDistrict);

  const bounds = [];

  precinctLayer.eachLayer((layer) => {
    const p = layer.feature?.properties || {};
    const haveCounty = norm(
      p.county || p.COUNTYNAME || p.countyname || p.County
    );
    const haveSen = norm(p.mn_senate);
    const haveHouse = norm(p.mn_house);

    const countyMatch =
      !wantCounty || (haveCounty && haveCounty === wantCounty);
    const senateMatch = !wantSen || (haveSen && haveSen === wantSen);
    const houseMatch = !wantHouse || (haveHouse && haveHouse === wantHouse);

    const visible = countyMatch && senateMatch && houseMatch;

    layer.setStyle({
      opacity: visible ? 1 : 0,
      fillOpacity: visible ? 0.8 : 0,
    });

    if (visible) bounds.push(layer.getBounds());
  });

  if (bounds.length) {
    const b = bounds.reduce(
      (acc, cur) => acc.extend(cur),
      L.latLngBounds(bounds[0])
    );
    precinctLayer._map.fitBounds(b.pad(0.05));
  }
}

function styleFn(feature) {
  const color = currentPaint.getColor(feature.properties.precinct_id);
  return { color: "#ffffff", weight: 0.5, fillColor: color, fillOpacity: 0.8 };
}

function handleMapClick(e) {
  const props = e.target.feature.properties;
  if (!props.precinct_id && (props.VTDID || props.vtdid)) {
    props.precinct_id = props.VTDID || props.vtdid;
  }
  if (onClickFeatureCb) {
    onClickFeatureCb(props);
  }
}

export function attachFeatureHandlers() {
  precinctLayer.eachLayer((layer) => {
    layer.on("click", handleMapClick);
    layer.on("mouseover", () => layer.setStyle({ weight: 2 }));
    layer.on("mouseout", () => layer.setStyle({ weight: 0.5 }));
  });
}
