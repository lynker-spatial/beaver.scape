/* Static Assets */
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

/* Imports */
import { LogoControl } from "./controls/LogoControl";
import { Protocol } from "pmtiles";
import maplibregl, { NavigationControl } from "maplibre-gl";

/**
 * Renders a PMTiles archive that contains:
 *  - 2013/2015/2017/2019/2021 Colorado Beaver Activity Areas (polygons)
 *  - HUC10_CO (exported as "huc10")
 *  - CO_merged_owner (exported as "owner")
 *
 * The symbology below mirrors the provide legend:
 *  Ownership categories are colored with a categorical match; Beavers are
 *  outlined per year with faint fills; HUC10 is a thin black outline.
 */

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------

// Place tmp.pmtiles at: public/tiles/tmp.pmtiles
// Vite will serve it at: <BASE_URL>/tiles/tmp.pmtiles
const tiles_url = "https://data.lynker-spatial.com/vector-resources/beaver-scape/beaver-scape.pmtiles"

// Debug: verify URL actually used by browser
// eslint-disable-next-line no-console
// console.log("PMTiles URL:", tiles_url);

// Source-layer names inside the PMTiles
const LAYERS = {
  owner: "owner",
  huc10: "huc10",
  beaver: [
    "2013_Colorado_Beaver_Activity_Areas",
    "2015_Colorado_Beaver_Activity_Areas",
    "2017_Colorado_Beaver_Activity_Areas",
    "2019_Colorado_Beaver_Activity_Areas",
    "2021_Colorado_Beaver_Activity_Areas",
  ] as const,
};

// Ownership category -> color map (approximate hex colors from legend)
const OWNER_COLORS: Record<string, string> = {
  "American Indian Lands": "#E07AAE",
  "Federal": "#A779E9",
  "Joint": "#6FB8FF",
  "Local Government": "#FF2B2B",
  "Non-Governmental Organization": "#B7C400",
  "Private": "#46E0C0",
  "Regional Agency Special District": "#17B657",
  "State": "#E3A455",
  "Unknown": "#909090",
};

/** Substring aliases for owner categories (used by legend filtering). */
// const OWNER_ALIASES: Record<string, string[]> = {
//   "American Indian Lands": ["american indian", "tribal", "ute"],
//   "Federal": [
//     "federal",
//     "blm",
//     "bureau of land",
//     "usfs",
//     "forest service",
//     "nps",
//     "park service",
//     "fws",
//     "fish and wildlife"
//   ],
//   "State": [
//     "state",
//     "colorado parks and wildlife",
//     "cpw",
//     "state land board"
//   ],
//   "Local Government": ["county", "city", "town", "municipal"],
//   "Non-Governmental Organization": ["ngo", "non-governmental", "conservancy", "land trust", "trust"],
//   "Private": ["private"],
//   "Regional Agency Special District": ["district", "authority", "metro", "water"],
//   "Joint": ["joint"],
//   "Unknown": ["unknown", ""]
// };

/** Ownership coloring: robust matcher on d_Mang_Type (case-insensitive),
 * with aliases for common agency names.
 */
const ownerMatchExpression: any = [
  "let",
  "o",
  ["downcase", ["to-string", ["get", "d_Mang_Type"]]],
  [
    "case",
    // ---- exact canonical labels ----
    ["==", ["var", "o"], "american indian lands"], "#E07AAE",
    ["==", ["var", "o"], "federal"], "#A779E9",
    ["==", ["var", "o"], "joint"], "#6FB8FF",
    ["==", ["var", "o"], "local government"], "#FF2B2B",
    ["==", ["var", "o"], "non-governmental organization"], "#B7C400",
    ["==", ["var", "o"], "private"], "#46E0C0",
    ["==", ["var", "o"], "regional agency special district"], "#17B657",
    ["==", ["var", "o"], "state"], "#E3A455",
    ["==", ["var", "o"], "unknown"], "#909090",

    // ---- American Indian aliases ----
    [">=", ["index-of", "american indian", ["var", "o"]], 0], "#E07AAE",
    [">=", ["index-of", "tribal", ["var", "o"]], 0], "#E07AAE",
    [">=", ["index-of", "ute", ["var", "o"]], 0], "#E07AAE",

    // ---- Federal aliases (BLM/USFS/NPS/FWS/etc.) ----
    [">=", ["index-of", "blm", ["var", "o"]], 0], "#A779E9",
    [">=", ["index-of", "bureau of land", ["var", "o"]], 0], "#A779E9",
    [">=", ["index-of", "usfs", ["var", "o"]], 0], "#A779E9",
    [">=", ["index-of", "forest service", ["var", "o"]], 0], "#A779E9",
    [">=", ["index-of", "nps", ["var", "o"]], 0], "#A779E9",
    [">=", ["index-of", "park service", ["var", "o"]], 0], "#A779E9",
    [">=", ["index-of", "fws", ["var", "o"]], 0], "#A779E9",
    [">=", ["index-of", "fish and wildlife", ["var", "o"]], 0], "#A779E9",
    [">=", ["index-of", "burea", ["var", "o"]], 0], "#A779E9", /* catch typos */
    [">=", ["index-of", "federal", ["var", "o"]], 0], "#A779E9",

    // ---- State aliases ----
    [">=", ["index-of", "state", ["var", "o"]], 0], "#E3A455",
    [">=", ["index-of", "colorado parks and wildlife", ["var", "o"]], 0], "#E3A455",
    [">=", ["index-of", "cpw", ["var", "o"]], 0], "#E3A455",
    [">=", ["index-of", "state land board", ["var", "o"]], 0], "#E3A455",

    // ---- Local government aliases ----
    [">=", ["index-of", "county", ["var", "o"]], 0], "#FF2B2B",
    [">=", ["index-of", "city", ["var", "o"]], 0], "#FF2B2B",
    [">=", ["index-of", "town", ["var", "o"]], 0], "#FF2B2B",
    [">=", ["index-of", "municipal", ["var", "o"]], 0], "#FF2B2B",

    // ---- NGO / Land trust aliases ----
    [">=", ["index-of", "ngo", ["var", "o"]], 0], "#B7C400",
    [">=", ["index-of", "non-governmental", ["var", "o"]], 0], "#B7C400",
    [">=", ["index-of", "conservancy", ["var", "o"]], 0], "#B7C400",
    [">=", ["index-of", "land trust", ["var", "o"]], 0], "#B7C400",
    [">=", ["index-of", "trust", ["var", "o"]], 0], "#B7C400",

    // ---- Private aliases ----
    [">=", ["index-of", "private", ["var", "o"]], 0], "#46E0C0",

    // ---- Regional / Special Districts ----
    [">=", ["index-of", "district", ["var", "o"]], 0], "#17B657",
    [">=", ["index-of", "authority", ["var", "o"]], 0], "#17B657",
    [">=", ["index-of", "metro", ["var", "o"]], 0], "#17B657",
    [">=", ["index-of", "water", ["var", "o"]], 0], "#17B657",

    // ---- Joint ----
    [">=", ["index-of", "joint", ["var", "o"]], 0], "#6FB8FF",

    // ---- Unknown / missing ----
    ["==", ["var", "o"], ""], "#909090",
    [">=", ["index-of", "unknown", ["var", "o"]], 0], "#909090",

    // Fallback
    "#C0C0C0"
  ]
];

// Year outline colors
const BEAVER_OUTLINE: Record<string, string> = {
  "2013_Colorado_Beaver_Activity_Areas": "#3FB64B", // green
  "2015_Colorado_Beaver_Activity_Areas": "#7D1739", // burgundy
  "2017_Colorado_Beaver_Activity_Areas": "#C97B7F", // rose
  "2019_Colorado_Beaver_Activity_Areas": "#F2C300", // yellow
  "2021_Colorado_Beaver_Activity_Areas": "#FFC233", // golden
};

// ----------------------------------------------------------------------------

class LegendControl {
  private _container!: HTMLDivElement;
  onAdd(_map: maplibregl.Map) {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    container.style.maxWidth = "280px";
    container.style.padding = "8px";
    container.style.background = "rgba(255,255,255,0.9)";
    container.style.font = "12px/1.3 sans-serif";
    container.style.overflow = "auto";
    container.style.maxHeight = "50vh";

    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.style.marginBottom = "6px";
    title.textContent = "Layers";
    container.appendChild(title);

    // Owner legend (selectable by d_Mang_Type)
    const ownerHdr = document.createElement("div");
    ownerHdr.style.fontWeight = "600";
    ownerHdr.style.margin = "8px 0 4px";
    ownerHdr.textContent = "Ownership";
    container.appendChild(ownerHdr);

    const ownerList = document.createElement("div");
    ownerList.style.display = "grid";
    ownerList.style.gridTemplateColumns = "1fr";
    ownerList.style.gap = "4px";
    container.appendChild(ownerList);

    const categories = Object.keys(OWNER_COLORS);
    const selected = new Set<string>(categories);

    function rebuildOwnerFilter() {
      // If everything is selected, clear filters
      if (selected.size === categories.length) {
        try { _map.setFilter("owner-fill", undefined as any); } catch {}
        try { _map.setFilter("owner-outline", undefined as any); } catch {}
        return;
      }

      // Case-insensitive exact match on the enumerated classes in d_Mang_Type
      const dval = ["downcase", ["to-string", ["get", "d_Mang_Type"]]] as any;
      const selectedList = Array.from(selected).map((s) => s.toLowerCase());

      const filterExpr: any = ["in", dval, ["literal", selectedList]];
      try { _map.setFilter("owner-fill", filterExpr as any); } catch {}
      try { _map.setFilter("owner-outline", filterExpr as any); } catch {}
    }

    for (const [label, color] of Object.entries(OWNER_COLORS)) {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.margin = "2px 0";
      row.style.cursor = "pointer";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = true;
      chk.style.margin = "0";

      const sw = document.createElement("span");
      sw.style.display = "inline-block";
      sw.style.width = "12px";
      sw.style.height = "12px";
      sw.style.border = "1px solid #999";
      sw.style.background = color;

      const txt = document.createElement("span");
      txt.textContent = label;

      chk.addEventListener("change", () => {
        if (chk.checked) {
          selected.add(label);
        } else {
          selected.delete(label);
        }
        rebuildOwnerFilter();
      });

      row.appendChild(chk);
      row.appendChild(sw);
      row.appendChild(txt);
      ownerList.appendChild(row);
    }

    // HUC10 toggle
    const hucRow = document.createElement("div");
    hucRow.style.margin = "8px 0 4px";
    const hucChk = document.createElement("input");
    hucChk.type = "checkbox";
    hucChk.checked = true;
    hucChk.id = "lg-huc10";
    const hucLbl = document.createElement("label");
    hucLbl.htmlFor = "lg-huc10";
    hucLbl.textContent = "HUC10 outline";
    hucLbl.style.marginLeft = "6px";
    hucRow.appendChild(hucChk);
    hucRow.appendChild(hucLbl);
    container.appendChild(hucRow);

    // Beaver toggles
    const beaverHdr = document.createElement("div");
    beaverHdr.style.fontWeight = "600";
    beaverHdr.style.margin = "8px 0 4px";
    beaverHdr.textContent = "Beaver Activity Areas";
    container.appendChild(beaverHdr);

    for (const layer of LAYERS.beaver) {
      const row = document.createElement("div");
      const id = `lg-${layer}`;
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = true;
      chk.id = id;

      const lbl = document.createElement("label");
      lbl.htmlFor = id;
      lbl.textContent = layer.replace("_Colorado_Beaver_Activity_Areas", "");
      lbl.style.marginLeft = "6px";

      const sw = document.createElement("span");
      sw.style.display = "inline-block";
      sw.style.width = "12px";
      sw.style.height = "12px";
      sw.style.border = "1px solid #999";
      sw.style.marginLeft = "6px";
      sw.style.background = BEAVER_OUTLINE[layer] ?? "#888";

      row.appendChild(chk);
      row.appendChild(lbl);
      row.appendChild(sw);
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.margin = "2px 0";
      container.appendChild(row);

      chk.addEventListener("change", () => {
        const fillId = `beaver-${layer}-fill`;
        const lineId = `beaver-${layer}-outline`;
        const vis = chk.checked ? "visible" : "none";
        try { _map.setLayoutProperty(fillId, "visibility", vis); } catch {}
        try { _map.setLayoutProperty(lineId, "visibility", vis); } catch {}
      });
    }

    // Toggle ownership as a group
    const ownerToggle = document.createElement("div");
    ownerToggle.style.marginTop = "8px";
    const ownerChk = document.createElement("input");
    ownerChk.type = "checkbox";
    ownerChk.checked = true;
    ownerChk.id = "lg-owner";
    const ownerLbl = document.createElement("label");
    ownerLbl.htmlFor = "lg-owner";
    ownerLbl.textContent = "Show ownership";
    ownerLbl.style.marginLeft = "6px";
    ownerToggle.appendChild(ownerChk);
    ownerToggle.appendChild(ownerLbl);
    container.appendChild(ownerToggle);

    ownerChk.addEventListener("change", () => {
      const vis = ownerChk.checked ? "visible" : "none";
      try { _map.setLayoutProperty("owner-fill", "visibility", vis); } catch {}
      try { _map.setLayoutProperty("owner-outline", "visibility", vis); } catch {}
    });

    // Hook up HUC10 toggle
    hucChk.addEventListener("change", () => {
      const vis = hucChk.checked ? "visible" : "none";
      try { _map.setLayoutProperty("huc10-outline", "visibility", vis); } catch {}
    });

    this._container = container;
    return container;
  }
  onRemove() {
    this._container?.remove();
  }
}

// Add PMTiles protocol to MapLibre
const pmtiles = new Protocol();
maplibregl.addProtocol("pmtiles", pmtiles.tile);

// Start with an empty style and add a satellite raster basemap
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {},
    layers: [],
  } as maplibregl.StyleSpecification,
  center: [-105.5, 39.0],
  zoom: 6,
  hash: true,
});

// Surface any MapLibre/GL errors
map.on("error", (e) => {
  // eslint-disable-next-line no-console
  console.warn("Map error:", e && (e as any).error ? (e as any).error : e);
});

// Build once the map style is ready
map.once("load", async () => {
  map.addControl(new NavigationControl(), "top-right");
  map.addControl(new LogoControl(), "bottom-left");

  // Satellite basemap (Esri World Imagery)
  map.addSource("esri-sat", {
    type: "raster",
    tiles: [
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    tileSize: 256,
    attribution:
      'Imagery &copy; <a href="https://www.esri.com/">Esri</a> | Boundaries &copy; contributors',
  });
  map.addLayer({
    id: "basemap-satellite",
    type: "raster",
    source: "esri-sat",
  });

  map.addControl(new LegendControl(), "top-left");

  // PMTiles vector source
  map.addSource("ref", {
    type: "vector",
    url: `pmtiles://${tiles_url}`,
    attribution:
      '&copy; <a href="https://www.lynker-spatial.com" target="_blank" rel="noopener">Lynker Spatial</a>',
  });

  // Helper to guard against duplicate layer adds
  function safeAddLayer(layer: maplibregl.LayerSpecification) {
    try {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to add layer ${layer.id}:`, err);
    }
  }

  // Wait until the vector source is fully loaded before adding layers
  const addLayersWhenReady = async () => {
    // Wait for source to load
    await new Promise<void>((resolve) => {
      if ((map.getSource("ref") as any)?._loaded) {
        resolve();
      } else {
        const onData = (e: any) => {
          if (e.sourceId === "ref" && e.isSourceLoaded) {
            map.off("sourcedata", onData);
            resolve();
          }
        };
        map.on("sourcedata", onData);
      }
    });

    // Read PMTiles metadata to discover vector layer IDs
    let layerIds = new Set<string>();
    try {
      const { PMTiles } = await import("pmtiles");
      const archive = new PMTiles(tiles_url);
      const meta = await archive.getMetadata();
      const vectorLayers = (meta as any)?.vector_layers || [];
      layerIds = new Set(vectorLayers.map((l: any) => l.id));
      // eslint-disable-next-line no-console
      console.log("Vector layers discovered:", Array.from(layerIds));

      // Debug: sample unique d_Mang_Type values in view
      try {
        const feats = map.querySourceFeatures("ref", { sourceLayer: LAYERS.owner }) || [];
        const counts = new Map<string, number>();
        for (const f of feats) {
          const v = String((f.properties as any)?.d_Mang_Type ?? "").toLowerCase();
          counts.set(v, (counts.get(v) || 0) + 1);
        }
        const top = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,15);
        console.log("Top d_Mang_Type values in view:", top);
      } catch (e) {
        console.warn("Owner category debug failed:", e);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Unable to read PMTiles metadata. Proceeding optimistically.", e);
    }

    // Ownership (only if layer exists)
    if (layerIds.size === 0 || layerIds.has(LAYERS.owner)) {
      safeAddLayer({
        id: "owner-fill",
        type: "fill",
        source: "ref",
        "source-layer": LAYERS.owner,
        paint: { "fill-color": ownerMatchExpression as any, "fill-opacity": 0.35 },
      } as any);

      safeAddLayer({
        id: "owner-outline",
        type: "line",
        source: "ref",
        "source-layer": LAYERS.owner,
        paint: { "line-color": "#222", "line-width": 0.5, "line-opacity": 0.6 },
      } as any);
    } else {
      console.warn(`Layer '${LAYERS.owner}' not found in PMTiles; skipping ownership symbology.`);
    }

    // HUC10 (only if layer exists)
    if (layerIds.size === 0 || layerIds.has(LAYERS.huc10)) {
      safeAddLayer({
        id: "huc10-outline",
        type: "line",
        source: "ref",
        "source-layer": LAYERS.huc10,
        paint: { "line-color": "#000000", "line-width": 0.6, "line-opacity": 0.8 },
      } as any);
    } else {
      console.warn(`Layer '${LAYERS.huc10}' not found in PMTiles; skipping HUC symbology.`);
    }

    // Beaver years (add those that exist)
    for (const layer of LAYERS.beaver) {
      if (layerIds.size > 0 && !layerIds.has(layer)) {
        console.warn(`Beaver layer '${layer}' not found in PMTiles; skipping.`);
        continue;
      }
      const outline = BEAVER_OUTLINE[layer] ?? "#888888";
      const fillId = `beaver-${layer}-fill`;
      const lineId = `beaver-${layer}-outline`;

      safeAddLayer({
        id: fillId,
        type: "fill",
        source: "ref",
        "source-layer": layer,
        paint: { "fill-color": outline, "fill-opacity": 0.18 },
      } as any);

      safeAddLayer({
        id: lineId,
        type: "line",
        source: "ref",
        "source-layer": layer,
        paint: { "line-color": outline, "line-width": 0.8 },
      } as any);
    }
  };

  addLayersWhenReady();

  map.on("sourcedata", (e) => {
    if (e.sourceId === "ref" && (e as any).isSourceLoaded) {
      // eslint-disable-next-line no-console
      console.log("Vector source 'ref' loaded.");
    }
  });

  // Debug: print PMTiles metadata/layers
  try {
    // Use PMTiles reader to inspect metadata and layer IDs
    const { PMTiles } = await import("pmtiles");
    const archive = new PMTiles(tiles_url);
    const meta = await archive.getMetadata();
    // eslint-disable-next-line no-console
    console.log("PMTiles metadata:", meta);
    // eslint-disable-next-line no-console
    console.log("Vector layers:", (meta as any)?.vector_layers?.map((l: any) => l.id));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Unable to read PMTiles metadata:", e);
  }

  // --- Interactivity: popup on click across all thematic layers ---
  const clickableIds = [
    "owner-fill",
    "huc10-outline",
    ...LAYERS.beaver.map((l) => `beaver-${l}-fill`),
    ...LAYERS.beaver.map((l) => `beaver-${l}-outline`),
  ];

  type MouseEvent = maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[];
  };

  const popupRoot = document.createElement("span");

  // function escapeHtml(s: unknown): string {
  //   return String(s ?? "")
  //     .replace(/&/g, "&amp;")
  //     .replace(/</g, "&lt;")
  //     .replace(/>/g, "&gt;");
  // }

  async function popupText( 
    _root: HTMLElement,
    feature: maplibregl.MapGeoJSONFeature
  ): Promise<string> {
    const props = feature.properties || {};
 
    const rows = Object.entries(props)
      .map(
        ([key, value]) => `
          <tr>
            <th style="text-align:left; padding:4px; border:1px solid #ddd; background:#f9f9f9;">
              ${key}
            </th>
            <td style="padding:4px; border:1px solid #ddd;">
              ${String(value)}
            </td>
          </tr>`
      )
      .join("");

    return `
      <div style="max-height:200px; overflow:auto;">
        <table style="border-collapse:collapse; font-family:sans-serif; font-size:13px; width:100%;">
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>`;
  }

  async function popupEvent(event: MouseEvent) {
    if (!event.features || event.features.length === 0) return;
    const currentFeature = event.features[0];
    popupRoot.innerHTML = await popupText(popupRoot, currentFeature);
    new maplibregl.Popup()
      .setMaxWidth("none")
      .setLngLat(event.lngLat)
      .setDOMContent(popupRoot)
      .addTo(map);
  }

  for (const id of clickableIds) {
    map.on("click", id, popupEvent);
    map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
  }
});
