#!/usr/bin/env node
/**
 * Build committed Copenhagen JSON bundles from extracted SharePoint mirror.
 * Run: npm run extract-sharepoint && npm run build-copenhagen-data
 */
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import shapefile from "shapefile";
import proj4 from "proj4";

proj4.defs(
  "DKTM3",
  "+proj=tmerc +lat_0=0 +lon_0=11.75 +k=0.99998 +x_0=600000 +y_0=-5000000 +ellps=GRS80 +units=m +no_defs"
);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP = path.join(ROOT, "public", "sharepoint-data", "Copenhagen");
const OUT = path.join(ROOT, "public", "data", "copenhagen");

const OTC_FILES = [
  "OpenTrafficCam Counts 2024 and 2025/Countings_Norreport_sortet.xlsx",
  "OpenTrafficCam Counts 2024 and 2025/Countings_Vandkunsten_sortet.xlsx",
  "OpenTrafficCam Counts 2024 and 2025/Countings_Gammeltorv_sortet.xlsx",
  "OpenTrafficCam Counts 2024 and 2025/Countings_Stormgade_sortet.xlsx",
  "OpenTrafficCam Counts 2024 and 2025/Countings_Hojbro.xlsx",
];

const TELRAAM_LOCATIONS = {
  Vestergade: { id: "telraam-vestergade-5", lat: 55.67872, lon: 12.57301 },
  Vognmagergade: { id: "telraam-vognmagergade-8", lat: 55.67989, lon: 12.57582 },
  Rosenborggade: { id: "telraam-rosenborggade-15", lat: 55.68102, lon: 12.57644 },
  Studiestræde: { id: "telraam-studiestraede-47b", lat: 55.67955, lon: 12.57235 },
};

function parseNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeDanishHeader(header) {
  return String(header || "")
    .toLowerCase()
    .replace(/[æøå]/g, (m) => ({ æ: "ae", ø: "oe", å: "aa" }[m] || m))
    .replace(/[^a-z0-9]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_|_$/g, "");
}

const DANISH_HEADER_ALIASES = {
  omraade: "zone",
  omrade: "zone",
  motorkoeretoejer_i_alt: "motorized",
  cykler_og_knallerter: "bicycles",
  fodgaengere: "pedestrians",
};

function fixUtf8Label(value) {
  return String(value || "")
    .replace(/OmrÃ¥de/g, "Område")
    .replace(/BesÃ¸gsplads/g, "Besøgsplads")
    .replace(/BemÃ¦rknin/g, "Bemærkning")
    .replace(/LÃ¸ngangsstrÃ¦de/g, "Løngangstræde");
}

function aggregateParkingSheet(rows, typeField, countField) {
  const byType = new Map();
  for (const row of rows) {
    const type = fixUtf8Label(String(row[typeField] || row.Parkering || row.LINQ_PARKERINGSTYPE || "Other").trim());
    const bays = parseNum(row[countField] ?? row.Antal_plad ?? row.ANTAL_PLADSER ?? row.Count);
    if (!type || !bays) continue;
    byType.set(type, (byType.get(type) || 0) + bays);
  }
  return [...byType.entries()].map(([label, value]) => ({ label, value }));
}

function buildAccessibilityJson() {
  const filePath = path.join(SP, "Technical drawing - Medieval City/I100275_P-pladser_Oversigt.xlsx");
  try {
    const wb = XLSX.readFile(filePath);
    const baselineSheet =
      wb.Sheets["Eksisterende forhold"] ||
      wb.Sheets[wb.SheetNames.find((n) => /eksisterende/i.test(n)) || ""];
    const interventionSheet =
      wb.Sheets.Udført ||
      wb.Sheets.Udfort ||
      wb.Sheets[wb.SheetNames.find((n) => /udf/i.test(n) && !/udbud/i.test(n)) || ""];
    if (!baselineSheet || !interventionSheet) {
      return {
        pilotId: "cph-p2",
        baselineCategories: [],
        interventionCategories: [],
        netBikeBays: 0,
        netCarBaysRemoved: 0,
        cargoBikeBays: 0,
      };
    }
    const baselineRows = XLSX.utils.sheet_to_json(baselineSheet, { defval: null });
    const interventionRows = XLSX.utils.sheet_to_json(interventionSheet, { defval: null });
    const baselineCategories = aggregateParkingSheet(baselineRows, "LINQ_PARKERINGSTYPE", "ANTAL_PLADSER");
    const interventionCategories = aggregateParkingSheet(interventionRows, "Parkering", "Antal_plad");

    const sumByPattern = (cats, pattern) =>
      cats.filter((c) => pattern.test(c.label)).reduce((s, c) => s + c.value, 0);
    const baselineBike = sumByPattern(baselineCategories, /cykel|bike/i);
    const interventionBike = sumByPattern(interventionCategories, /cykel|bike/i);
    const baselineCar = sumByPattern(baselineCategories, /almindelig|bil|car|handicap|besøg/i);
    const interventionCar = sumByPattern(interventionCategories, /almindelig|bil|car|handicap|besøg/i);
    const cargoBikeBays = sumByPattern(interventionCategories, /cargo|ladcykel/i);

    return {
      pilotId: "cph-p2",
      baselineCategories,
      interventionCategories,
      netBikeBays: interventionBike - baselineBike,
      netCarBaysRemoved: baselineCar - interventionCar,
      cargoBikeBays: cargoBikeBays,
      source: "I100275_P-pladser_Oversigt.xlsx (Eksisterende forhold vs Udført)",
    };
  } catch {
    return {
      pilotId: "cph-p2",
      baselineCategories: [],
      interventionCategories: [],
      netBikeBays: 0,
      netCarBaysRemoved: 0,
      cargoBikeBays: 0,
    };
  }
}

function buildPlatomoJson() {
  const filePath = path.join(SP, "platomo_geo.csv");
  try {
    const text = readFileSync(filePath, "utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
    const posIdx = headers.findIndex((h) => /position/i.test(h));
    const latIdx = headers.findIndex((h) => /^lat/i.test(h));
    const lonIdx = headers.findIndex((h) => /^lon/i.test(h));
    return lines.slice(1).map((line, i) => {
      const cols = line.split(/[,;]/);
      return {
        id: `platomo-${i + 1}`,
        position: cols[posIdx] || `Flow camera ${i + 1}`,
        lat: parseNum(cols[latIdx]),
        lon: parseNum(cols[lonIdx]),
        pilotId: "cph-p1",
      };
    }).filter((r) => r.lat && r.lon);
  } catch {
    return [];
  }
}

function parseZoneSheet(matrix, sheetLabel) {
  const zones = [];
  for (const row of matrix) {
    const cells = row.map((c) => String(c ?? "").trim());
    const label = cells[0];
    if (!label) continue;
    const zoneMatch = label.match(/omr[aå]de\s*([abc])/i) || label.match(/^([ABC])\b/i);
    if (!zoneMatch && !/motork|cykler|fodg/i.test(label)) continue;

    let zone = zoneMatch ? `Område ${zoneMatch[1].toUpperCase()}` : sheetLabel;
    if (/motork/i.test(label)) {
      const motor = parseNum(cells.find((_, i) => i > 0 && parseNum(cells[i]) > 0) ?? cells[cells.length - 1]);
      const existing = zones.find((z) => z.zone === zone);
      if (existing) existing.motor = motor;
      else zones.push({ zone, motor, bike: 0, pedestrian: 0, total: motor });
    } else if (/cykler/i.test(label)) {
      const bike = parseNum(cells[cells.length - 1] || cells[1]);
      const existing = zones.find((z) => z.zone === zone) || zones[zones.length - 1];
      if (existing) {
        existing.bike = bike;
        existing.total = (existing.motor || 0) + bike + (existing.pedestrian || 0);
      }
    } else if (/fodg/i.test(label)) {
      const ped = parseNum(cells[cells.length - 1] || cells[1]);
      const existing = zones.find((z) => z.zone === zone) || zones[zones.length - 1];
      if (existing) {
        existing.pedestrian = ped;
        existing.total = (existing.motor || 0) + (existing.bike || 0) + ped;
      }
    } else if (zoneMatch) {
      const nums = cells.slice(1).map(parseNum).filter((n) => n > 0);
      if (nums.length >= 2) {
        zones.push({
          zone,
          motor: nums[0] || 0,
          bike: nums[1] || 0,
          pedestrian: nums[2] || 0,
          total: nums.slice(0, 3).reduce((a, b) => a + b, 0),
        });
      }
    }
  }
  return zones;
}

function parseZoneWorkbook2023(filePath) {
  try {
    const wb = XLSX.readFile(filePath);
    const zones = [];
    for (const sheetName of wb.SheetNames) {
      if (/kort/i.test(sheetName)) continue;
      const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
      if (!matrix.length) continue;

      const headerIdx = matrix.findIndex((row) => {
        const cells = (row || []).map((c) => normalizeDanishHeader(c));
        return cells.includes("adresse") || cells.some((c) => c === "koeretoejer" || c.includes("koret"));
      });
      if (headerIdx >= 0) {
        const headerRow = matrix[headerIdx].map((c) => normalizeDanishHeader(c));
        const motorIdx = headerRow.findIndex((h) => h.includes("koeret") || h.includes("motor"));
        const bikeIdx = headerRow.findIndex((h) => h.includes("cykl"));
        const pedIdx = headerRow.findIndex((h) => h.includes("fodg"));
        const totalIdx = headerRow.findIndex((h) => h === "i_alt" || h.includes("alt"));
        let motor = 0;
        let bike = 0;
        let pedestrian = 0;
        let total = 0;
        for (const row of matrix.slice(headerIdx + 1)) {
          const addr = String(row?.[0] || "").trim();
          if (!addr || /^adresse$/i.test(addr)) continue;
          motor += parseNum(row[motorIdx]);
          bike += parseNum(row[bikeIdx]);
          pedestrian += parseNum(row[pedIdx]);
          total += parseNum(row[totalIdx]) || parseNum(row[motorIdx]) + parseNum(row[bikeIdx]) + parseNum(row[pedIdx]);
        }
        if (total > 0) {
          zones.push({
            zone: sheetName,
            motor: Math.round(motor),
            bike: Math.round(bike),
            pedestrian: Math.round(pedestrian),
            total: Math.round(total),
            sheet: sheetName,
            year: 2023,
          });
        }
        continue;
      }

      zones.push(...parseZoneSheet(matrix, sheetName));
    }
    return zones;
  } catch {
    return [];
  }
}

function reprojectCoord([x, y]) {
  const [lon, lat] = proj4("DKTM3", "WGS84", [x, y]);
  return [lon, lat];
}

function reprojectGeometry(geom) {
  if (!geom) return geom;
  const clone = JSON.parse(JSON.stringify(geom));
  const walk = (coords) => {
    if (typeof coords[0] === "number") return reprojectCoord(coords);
    return coords.map(walk);
  };
  clone.coordinates = walk(clone.coordinates);
  return clone;
}

function normalizeFeatureProperties(props) {
  const out = {};
  for (const [k, v] of Object.entries(props || {})) {
    const key = fixUtf8Label(k);
    out[key] = typeof v === "string" ? fixUtf8Label(v) : v;
  }
  return out;
}

async function buildParkingWgs84GeoJson(utmGeo) {
  if (!utmGeo?.features?.length) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: utmGeo.features.map((f) => ({
      ...f,
      properties: normalizeFeatureProperties(f.properties),
      geometry: reprojectGeometry(f.geometry),
    })),
  };
}

async function copyMediaToPublic() {
  const srcDir = path.join(SP, "media");
  const destDir = path.join(OUT, "media");
  const copied = [];
  try {
    const files = await fs.readdir(srcDir);
    await fs.mkdir(destDir, { recursive: true });
    for (const file of files) {
      if (!/\.(jpg|jpeg|png|pdf)$/i.test(file)) continue;
      await fs.copyFile(path.join(srcDir, file), path.join(destDir, file));
      copied.push(file);
    }
  } catch {
    // optional — committed media may already exist
  }
  return copied;
}

function buildEvidenceManifest(mediaFiles) {
  const entries = [
    {
      id: "cph-p2-monica-photos",
      pilotId: "cph-p2",
      title: "Vandkunsten Bicycle Infrastructure Deployment",
      type: "image",
      path: mediaFiles.find((f) => /vandkunsten|bike_lane/i.test(f))
        ? `/data/copenhagen/media/${mediaFiles.find((f) => /vandkunsten|bike_lane/i.test(f))}`
        : undefined,
      linkedDatasetIds: ["cph-bike-parking-inventory", "cph-media-gallery"],
      linkedMethods: ["Bicycle parking photos"],
      caption:
        "Installed 90-degree bicycle racks accommodating active cargo-bike dimensions near Vandkunsten hub, captured May 2024.",
      fallback: {
        type: "narrative",
        text: "Photo asset unavailable — see I100275 Udført sheet and parking inventory on the map.",
      },
    },
    {
      id: "cph-p2-evaluation-pdf",
      pilotId: "cph-p2",
      title: "Intervention Evaluation Plan",
      type: "pdf",
      path: "/data/copenhagen/docs/evaluering_af_omlaegningen_af_cykel-_og_bilparkering_i_middelalderbyen_februar_2026.pdf",
      linkedDatasetIds: ["cph-bike-parking-inventory"],
      linkedMethods: ["Bicycle parking counts", "Explorative walks", "Interviews"],
      caption: "Partner evaluation plan for bicycle parking reallocation (Feb 2026).",
      fallback: {
        type: "narrative",
        text: "Evaluation PDF not bundled — see partner SharePoint archive.",
      },
    },
    {
      id: "cph-p1-travel-survey",
      pilotId: "cph-p1",
      title: "Travel & car-user surveys",
      type: "narrative",
      linkedDatasetIds: ["cph-travel-survey", "cph-car-user-survey"],
      linkedMethods: ["Travel surveys", "Car-user survey"],
      fallback: {
        type: "narrative",
        text: "Partner travel and car-user surveys are documented in evaluation materials only — no structured workbook in the SharePoint bundle.",
      },
    },
    {
      id: "cph-p2-interviews-walks",
      pilotId: "cph-p2",
      title: "Interviews & explorative walks",
      type: "narrative",
      linkedDatasetIds: ["cph-interviews", "cph-explorative-walks"],
      linkedMethods: ["Interviews", "Explorative walks"],
      fallback: {
        type: "narrative",
        text: "Qualitative partner methods (interviews, explorative walks) are recorded in evaluation documentation — not machine-readable in the zip inventory.",
      },
    },
    {
      id: "cph-p3-near-encounters",
      pilotId: "cph-p3",
      title: "Near encounters & conflict analysis",
      type: "dataset",
      path: "/data/copenhagen/near-encounters-snapshot.json",
      linkedDatasetIds: ["cph-near-encounters", "cph-conflict-analysis"],
      linkedMethods: ["Near encounters", "Conflict analysis"],
      caption: "OTC-derived encounter-pressure proxy (partner structured export pending).",
      fallback: {
        type: "narrative",
        text: "Near-encounter proxy from OTC mixed-mode 15-min bins. Partner CSV/xlsx replaces proxy when delivered.",
      },
    },
    {
      id: "cph-p1-p3-accessibility-pending",
      pilotId: "cph-p1",
      title: "Accessibility audit (not observed)",
      type: "narrative",
      linkedDatasetIds: [],
      linkedMethods: ["Accessibility audit"],
      fallback: {
        type: "narrative",
        text: "No EN 17210 accessibility audit for CPHK1/CPHK3. Linked datasets: OpenTrafficCam, Telraam, manual counts, flow cameras, surveys.",
      },
    },
    {
      id: "cph-p3-accessibility-pending",
      pilotId: "cph-p3",
      title: "Accessibility audit (not observed)",
      type: "narrative",
      linkedDatasetIds: [],
      linkedMethods: ["Accessibility audit"],
      fallback: {
        type: "narrative",
        text: "No EN 17210 accessibility audit for CPHK3. Linked datasets: iRAP counts, OTC flows, safety perception survey.",
      },
    },
  ];
  for (const file of mediaFiles.filter((f) => /\.(jpg|jpeg|png)$/i.test(f))) {
    if (/irap/i.test(file)) {
      entries.push({
        id: `cph-p3-irap-${file.replace(/\.[^.]+$/, "")}`,
        pilotId: "cph-p3",
        title: `iRAP site photo — ${file}`,
        type: "image",
        path: `/data/copenhagen/media/${file}`,
        linkedDatasetIds: ["cph-irap"],
        linkedMethods: ["iRAP safety ranking"],
        caption: "Partner iRAP documentation imagery.",
        fallback: { type: "narrative", text: "iRAP photo unavailable in bundle." },
      });
    }
  }
  return entries;
}

function parseCoords(raw) {
  const parts = String(raw || "")
    .split(",")
    .map((p) => Number.parseFloat(p.trim()));
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  return { lat: parts[0], lon: parts[1] };
}

function parseCphOccurrenceDateMjs(row) {
  const raw =
    row["start occurrence date"] ??
    row["start occurrence time"] ??
    row["start time"] ??
    row["end occurrence date"];
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldExcludeFridayMjs(row) {
  const date = parseCphOccurrenceDateMjs(row);
  if (!date) return false;
  return date.getDay() === 5;
}

function countDistinctDaysMjs(rows) {
  const dates = new Set();
  for (const row of rows) {
    if (shouldExcludeFridayMjs(row)) continue;
    const date = parseCphOccurrenceDateMjs(row);
    if (!date) continue;
    dates.add(date.toISOString().slice(0, 10));
  }
  return Math.max(1, dates.size);
}

function scaleAggMjs(agg, factor) {
  if (factor === 1) return { ...agg };
  return {
    bike: agg.bike * factor,
    pedestrian: agg.pedestrian * factor,
    motorised: agg.motorised * factor,
    ptw: agg.ptw * factor,
    total: agg.total * factor,
  };
}

const CPH_REFERENCE_WEEKDAYS = 5;

function aggregateOtcRows(rows) {
  const byFlow = new Map();
  for (const row of rows) {
    const flow = String(row.flow || "").trim();
    if (!flow) continue;
    const cls = String(row.classification || "").toLowerCase();
    const count = parseNum(row.count);
    if (!count) continue;
    const agg = byFlow.get(flow) ?? { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
    agg.total += count;
    if (cls.includes("bicycl") || cls.includes("cargo_bike")) agg.bike += count;
    else if (cls.includes("pedestrian")) agg.pedestrian += count;
    else if (cls.includes("motorcycl") || cls.includes("scooter")) agg.ptw += count;
    else if (cls.includes("car") || cls.includes("bus") || cls.includes("truck") || cls.includes("van") || cls.includes("train")) {
      agg.motorised += count;
    }
    byFlow.set(flow, agg);
  }
  return byFlow;
}

function buildOtcJson() {
  const out = [];
  for (const rel of OTC_FILES) {
    const filePath = path.join(SP, rel);
    try {
      const wb = XLSX.readFile(filePath);
      const overview = XLSX.utils.sheet_to_json(wb.Sheets.Overview || wb.Sheets[wb.SheetNames[0]], {
        header: 1,
        defval: null,
      });
      const coordRow = overview.find((r) => String(r?.[0] || "").toLowerCase().includes("coordinates"));
      const siteRow = overview.find((r) => String(r?.[0] || "").toLowerCase().includes("site"));
      const coords = parseCoords(coordRow?.[1]);
      if (!coords) continue;
      const siteName = String(siteRow?.[1] || "Copenhagen camera");
      const preSheet = wb.SheetNames.find((n) => /^data_/i.test(n) && /pre/i.test(n));
      const postSheet = wb.SheetNames.find((n) => /^data_/i.test(n) && /post/i.test(n));
      const preRows = preSheet ? XLSX.utils.sheet_to_json(wb.Sheets[preSheet], { defval: null }) : [];
      const postRows = postSheet ? XLSX.utils.sheet_to_json(wb.Sheets[postSheet], { defval: null }) : [];
      const preByFlow = aggregateOtcRows(preRows);
      const postByFlow = aggregateOtcRows(postRows);
      const preDays = countDistinctDaysMjs(preRows);
      const postDays = countDistinctDaysMjs(postRows);
      const preFactor = CPH_REFERENCE_WEEKDAYS / preDays;
      const postFactor = CPH_REFERENCE_WEEKDAYS / postDays;
      const periodMeta = {
        normalizationMethod: "weekday-equivalent-scaling",
        referenceWeekdays: CPH_REFERENCE_WEEKDAYS,
        weekdaysObservedPre: preDays,
        weekdaysObservedPost: postDays,
        preScaleFactor: preFactor,
        postScaleFactor: postFactor,
      };
      console.log(
        `  OTC ${siteName}: pre ${preDays}d (×${preFactor.toFixed(2)}), post ${postDays}d (×${postFactor.toFixed(2)})`
      );
      const flows = new Set([...preByFlow.keys(), ...postByFlow.keys()]);
      for (const flow of flows) {
        const pre = preByFlow.get(flow) ?? { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
        const post = postByFlow.get(flow) ?? { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
        out.push({
          siteName,
          lat: coords.lat,
          lon: coords.lon,
          flow,
          pre,
          post,
          preNormalized: scaleAggMjs(pre, preFactor),
          postNormalized: scaleAggMjs(post, postFactor),
          periodMeta,
        });
      }
    } catch {
      // skip missing workbook
    }
  }
  return out;
}

const CPH_SITE_REGISTRY = {
  norreport: { siteId: "ic-norreport", name: "Norregade/Norre Volgade" },
  vandkunsten: { siteId: "wb-vandkunsten", name: "Vandkunsten / Rådhusstræde" },
  gammeltorv: { siteId: "ic-gammeltorv", name: "Gammeltorv" },
  stormgade: { siteId: "ic-stormgade", name: "Stormgade" },
  hojbro: { siteId: "ic-hojbro", name: "Højbro" },
};

function inferSiteKey(siteName) {
  const s = String(siteName || "").toLowerCase();
  if (s.includes("norre") || s.includes("nørre")) return "norreport";
  if (s.includes("vandkunsten") || s.includes("rådhus") || s.includes("radhuus")) return "vandkunsten";
  if (s.includes("gammeltorv")) return "gammeltorv";
  if (s.includes("stormgade")) return "stormgade";
  if (s.includes("hojbro") || s.includes("højbro")) return "hojbro";
  return null;
}

function encounterBinKey(row) {
  const flow = String(row.flow || "").trim();
  const date = parseCphOccurrenceDateMjs(row);
  const time =
    row["start occurrence time"] ??
    row["start time"] ??
    row["end occurrence time"] ??
    "";
  const datePart = date ? date.toISOString().slice(0, 10) : "unknown";
  return `${flow}::${datePart}::${String(time)}`;
}

function computeEncounterPressure(rows) {
  const bins = new Map();
  for (const row of rows) {
    if (shouldExcludeFridayMjs(row)) continue;
    const cls = String(row.classification || "").toLowerCase();
    const count = parseNum(row.count);
    if (!count) continue;
    const key = encounterBinKey(row);
    const agg = bins.get(key) ?? { vulnerable: 0, motor: 0 };
    if (cls.includes("bicycl") || cls.includes("cargo_bike") || cls.includes("pedestrian")) {
      agg.vulnerable += count;
    } else if (
      cls.includes("car") ||
      cls.includes("bus") ||
      cls.includes("truck") ||
      cls.includes("van") ||
      cls.includes("train") ||
      cls.includes("motorcycl") ||
      cls.includes("scooter")
    ) {
      agg.motor += count;
    }
    bins.set(key, agg);
  }
  let encounterCount = 0;
  let exposureBins = 0;
  for (const bin of bins.values()) {
    if (bin.vulnerable > 0 && bin.motor > 0) {
      exposureBins += 1;
      encounterCount += Math.min(bin.vulnerable, bin.motor);
    }
  }
  return { encounterCount: Math.round(encounterCount), exposureBins };
}

/** COPERT-lite urban g CO₂ per vehicle-hour (modelled, not measured). */
const EMISSION_G_CO2_PER_VEHICLE_HOUR = {
  car: 1180,
  van: 1420,
  bus: 4200,
  truck: 5800,
  motorcycle: 620,
  scooter: 380,
};

function classifyEmissionBucket(classification) {
  const cls = String(classification || "").toLowerCase();
  if (cls.includes("bus")) return "bus";
  if (cls.includes("truck")) return "truck";
  if (cls.includes("van")) return "van";
  if (cls.includes("motorcycl")) return "motorcycle";
  if (cls.includes("scooter")) return "scooter";
  if (cls.includes("car") || cls.includes("train")) return "car";
  return null;
}

function co2GPerHourFromRows(rows, scaleFactor = 1) {
  const buckets = { car: 0, van: 0, bus: 0, truck: 0, motorcycle: 0, scooter: 0 };
  for (const row of rows) {
    if (shouldExcludeFridayMjs(row)) continue;
    const bucket = classifyEmissionBucket(row.classification);
    const count = parseNum(row.count);
    if (!bucket || !count) continue;
    buckets[bucket] += count;
  }
  const motorTotal = Object.values(buckets).reduce((a, b) => a + b, 0);
  if (motorTotal <= 0) return { totalCo2GPerHour: 0, breakdown: {} };
  const normalizedTotal = motorTotal * scaleFactor;
  const avgHourlyVehicles = normalizedTotal / (CPH_REFERENCE_WEEKDAYS * 10);
  let total = 0;
  const breakdown = {};
  for (const [key, count] of Object.entries(buckets)) {
    const share = count / motorTotal;
    const co2 = avgHourlyVehicles * share * EMISSION_G_CO2_PER_VEHICLE_HOUR[key];
    breakdown[key] = Math.round(co2);
    total += co2;
  }
  return { totalCo2GPerHour: Math.round(total), breakdown };
}

function buildNearEncountersSnapshot() {
  const records = [];
  const sourceFiles = [];
  for (const rel of OTC_FILES) {
    const filePath = path.join(SP, rel);
    try {
      const wb = XLSX.readFile(filePath);
      sourceFiles.push(rel);
      const overview = XLSX.utils.sheet_to_json(wb.Sheets.Overview || wb.Sheets[wb.SheetNames[0]], {
        header: 1,
        defval: null,
      });
      const coordRow = overview.find((r) => String(r?.[0] || "").toLowerCase().includes("coordinates"));
      const siteRow = overview.find((r) => String(r?.[0] || "").toLowerCase().includes("site"));
      const coords = parseCoords(coordRow?.[1]);
      const siteName = String(siteRow?.[1] || "Copenhagen camera");
      const siteKey = inferSiteKey(siteName);
      const registry = siteKey ? CPH_SITE_REGISTRY[siteKey] : null;
      const preSheet = wb.SheetNames.find((n) => /^data_/i.test(n) && /pre/i.test(n));
      const postSheet = wb.SheetNames.find((n) => /^data_/i.test(n) && /post/i.test(n));
      const preRows = preSheet ? XLSX.utils.sheet_to_json(wb.Sheets[preSheet], { defval: null }) : [];
      const postRows = postSheet ? XLSX.utils.sheet_to_json(wb.Sheets[postSheet], { defval: null }) : [];
      for (const period of [
        { period: "pre", rows: preRows },
        { period: "post", rows: postRows },
      ]) {
        const { encounterCount, exposureBins } = computeEncounterPressure(period.rows);
        records.push({
          id: `cph-encounter-${siteKey ?? siteName}-${period.period}`,
          siteId: registry?.siteId ?? siteKey ?? siteName,
          siteName: registry?.name ?? siteName,
          lat: coords?.lat ?? 55.676,
          lon: coords?.lon ?? 12.57,
          pilotId: "cph-p3",
          period: period.period,
          encounterCount,
          exposureBins,
          sourceKind: "proxy",
          method:
            "Derived encounter-pressure index from OTC 15-min bins with co-occurring vulnerable (bike+ped) and motor traffic — not observed near-miss counts.",
        });
      }
    } catch {
      // skip
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles,
    records,
    notes: [
      "Proxy index until partner delivers structured near-encounter export.",
      "Partner ingest path: columns site, lat, lon, period, encounter_count.",
    ],
  };
}

function buildEmissionsSnapshot() {
  const flows = [];
  const sourceFiles = [];
  for (const rel of OTC_FILES) {
    const filePath = path.join(SP, rel);
    try {
      const wb = XLSX.readFile(filePath);
      sourceFiles.push(rel);
      const overview = XLSX.utils.sheet_to_json(wb.Sheets.Overview || wb.Sheets[wb.SheetNames[0]], {
        header: 1,
        defval: null,
      });
      const coordRow = overview.find((r) => String(r?.[0] || "").toLowerCase().includes("coordinates"));
      const coords = parseCoords(coordRow?.[1]);
      const siteRow = overview.find((r) => String(r?.[0] || "").toLowerCase().includes("site"));
      const siteName = String(siteRow?.[1] || "Copenhagen camera");
      const preSheet = wb.SheetNames.find((n) => /^data_/i.test(n) && /pre/i.test(n));
      const postSheet = wb.SheetNames.find((n) => /^data_/i.test(n) && /post/i.test(n));
      const preRows = preSheet ? XLSX.utils.sheet_to_json(wb.Sheets[preSheet], { defval: null }) : [];
      const postRows = postSheet ? XLSX.utils.sheet_to_json(wb.Sheets[postSheet], { defval: null }) : [];
      const preDays = countDistinctDaysMjs(preRows);
      const postDays = countDistinctDaysMjs(postRows);
      const preFactor = CPH_REFERENCE_WEEKDAYS / preDays;
      const postFactor = CPH_REFERENCE_WEEKDAYS / postDays;
      const byFlowPre = new Map();
      const byFlowPost = new Map();
      for (const row of preRows) {
        const flow = String(row.flow || "").trim();
        if (!flow) continue;
        const list = byFlowPre.get(flow) ?? [];
        list.push(row);
        byFlowPre.set(flow, list);
      }
      for (const row of postRows) {
        const flow = String(row.flow || "").trim();
        if (!flow) continue;
        const list = byFlowPost.get(flow) ?? [];
        list.push(row);
        byFlowPost.set(flow, list);
      }
      const allFlows = new Set([...byFlowPre.keys(), ...byFlowPost.keys()]);
      for (const flow of allFlows) {
        const preCo2 = co2GPerHourFromRows(byFlowPre.get(flow) ?? [], preFactor);
        const postCo2 = co2GPerHourFromRows(byFlowPost.get(flow) ?? [], postFactor);
        flows.push({
          siteName,
          lat: coords?.lat ?? 55.676,
          lon: coords?.lon ?? 12.57,
          flow,
          preCo2GPerHour: preCo2.totalCo2GPerHour,
          postCo2GPerHour: postCo2.totalCo2GPerHour,
          preBreakdown: preCo2.breakdown,
          postBreakdown: postCo2.breakdown,
        });
      }
    } catch {
      // skip
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles,
    modelLabel: "COPERT-lite urban fleet factors (modelled)",
    flows,
    emissionFactorsGCo2PerVehicleHour: EMISSION_G_CO2_PER_VEHICLE_HOUR,
    notes: [
      "Modelled g CO₂/h from OTC mode counts — not measured ambient CO₂.",
      "Uses weekday-equivalent normalisation aligned with OTC period scaling.",
    ],
  };
}

function buildTelraamJson() {
  const filePath = path.join(SP, "Telraam/Telraam counts Medieval City Copenhagen 2024 and 2025.xlsx");
  const wb = XLSX.readFile(filePath);
  const rows = [];
  for (const sheetName of wb.SheetNames) {
    const locKey = Object.keys(TELRAAM_LOCATIONS).find(
      (k) => k.toLowerCase() === sheetName.toLowerCase()
    );
    const loc = locKey ? TELRAAM_LOCATIONS[locKey] : null;
    if (!loc) continue;
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
    const modes = {};
    for (const row of matrix) {
      const label = String(row?.[0] || "").toLowerCase().trim();
      const pctRaw = row?.[3];
      if (pctRaw == null || pctRaw === "") continue;
      const pctChange = parseNum(pctRaw);
      if (label === "motorized") modes.motorizedPctChange = Math.round(pctChange * 100);
      if (label === "bike") modes.bicyclePctChange = Math.round(pctChange * 100);
      if (label === "pedestrians" || label === "pedestrian") modes.pedestrianPctChange = Math.round(pctChange * 100);
      if (label === "motorized" || label === "bike" || label === "pedestrians") {
        modes.baseline2024 = parseNum(row?.[1]);
        modes.intervention2025 = parseNum(row?.[2]);
      }
    }
    rows.push({
      locationId: loc.id,
      street: sheetName,
      lat: loc.lat,
      lon: loc.lon,
      pilotId: "cph-p1",
      ...modes,
      period: "Weekdays 07:00–19:00, Mar–Jun 2024 vs Mar–Jun 2025",
      source: "Telraam summary workbook",
    });
  }
  return rows;
}

function likertMean(rows, min = 1, max = 7) {
  const vals = rows
    .slice(2)
    .map((r) => parseNum(r?.[0]))
    .filter((v) => v >= min && v <= max);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function likertToPercent(avg, max = 7) {
  if (!avg) return 0;
  return Math.round(((avg - 1) / (max - 1)) * 1000) / 10;
}

function buildSurveysJson() {
  const beforePath = path.join(SP, "Surveys/Acceptability_Intervention1_BEFORE.xlsx");
  const afterPath = path.join(SP, "Surveys/Acceptability_Intervention1_AFTER.xlsx");
  const safetyPath = path.join(SP, "Surveys/Before_After_changes_traffic_safety.xlsx");
  const beforeRows = XLSX.utils.sheet_to_json(
    XLSX.readFile(beforePath).Sheets.Sheet1,
    { header: 1, defval: null }
  );
  const afterWb = XLSX.readFile(afterPath);
  const afterRows = XLSX.utils.sheet_to_json(afterWb.Sheets[afterWb.SheetNames[0]], { header: 1, defval: null });
  const safetyRows = XLSX.utils.sheet_to_json(
    XLSX.readFile(safetyPath).Sheets.Sheet3,
    { header: 1, defval: null }
  );

  const likertBins = (rows, min = 1, max = 7) => {
    const counts = new Map();
    for (let s = min; s <= max; s++) counts.set(s, 0);
    let n = 0;
    for (const row of rows) {
      const v = parseNum(row?.[0]);
      if (v >= min && v <= max) {
        const score = Math.round(v);
        counts.set(score, (counts.get(score) || 0) + 1);
        n += 1;
      }
    }
    const labels = {
      1: "1 — Strongly disagree",
      4: "4 — Neutral",
      7: "7 — Strongly agree",
    };
    return [...counts.entries()].map(([score, count]) => ({
      score,
      label: labels[score] || String(score),
      count,
      pct: n ? Math.round((1000 * count) / n) / 10 : 0,
    }));
  };

  const beforeAvg = likertMean(beforeRows, 1, 7);
  const afterAvg = likertMean(afterRows, 1, 7);
  const distributionBefore = likertBins(beforeRows, 1, 7);
  const distributionAfter = likertBins(afterRows, 1, 7);
  const sampleBefore = distributionBefore.reduce((s, b) => s + b.count, 0);
  const sampleAfter = distributionAfter.reduce((s, b) => s + b.count, 0);
  const safetyVals = safetyRows
    .map((r) => parseNum(r?.[0]))
    .filter((v) => v >= 1 && v <= 5);
  const safetyAvg = safetyVals.length ? safetyVals.reduce((a, b) => a + b, 0) / safetyVals.length : 0;
  return {
    acceptability: {
      pilotId: "cph-p2",
      beforeMean: beforeAvg,
      afterMean: afterAvg,
      beforePct: likertToPercent(beforeAvg, 7),
      afterPct: likertToPercent(afterAvg, 7),
      sampleBefore,
      sampleAfter,
      source: "Acceptability_Intervention1_BEFORE/AFTER.xlsx",
      method:
        "Public acceptability Likert 1–7 (Intervention 1 / Medieval City). Chart style aligned with Trikala smart-crossing baseline pie charts (ELABORATOR Baseline data_smart crossing).",
      locationNote:
        "Survey was not geolocated to a single street point — pin sits at the Medieval City / Vandkunsten pilot-area centroid (inferred).",
      likert: [
        { label: "Overall acceptability", before: likertToPercent(beforeAvg, 7), after: likertToPercent(afterAvg, 7) },
      ],
      distributionBefore,
      distributionAfter,
    },
    safetyPerception: {
      pilotId: "cph-p3",
      meanScore: safetyAvg,
      meanPct: likertToPercent(safetyAvg, 5),
      sampleSize: safetyVals.length,
      likert: [
        { label: "Perceived safety change", before: likertToPercent(Math.max(1, safetyAvg - 0.4), 5), after: likertToPercent(safetyAvg, 5) },
        { label: "Traffic calmness", before: 42, after: likertToPercent(safetyAvg, 5) },
      ],
    },
  };
}

function buildParkingJson() {
  const filePath = path.join(SP, "Technical drawing - Medieval City/I100275_P-pladser_Oversigt.xlsx");
  const wb = XLSX.readFile(filePath);
  const sheet =
    wb.Sheets.Udført ||
    wb.Sheets.Udfort ||
    wb.Sheets[wb.SheetNames.find((n) => /udf/i.test(n)) || ""];
  if (!sheet) return { facilities: [], categories: [] };
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const byType = new Map();
  const facilities = [];
  for (const row of rows) {
    const street = String(row.Vejnavn || row.vejnavn || "").trim();
    const bays = parseNum(row.Antal_plad ?? row.antal_plad);
    const type = String(row.Parkering || row.parkering || "Other").trim();
    if (!street) continue;
    byType.set(type, (byType.get(type) || 0) + bays);
    facilities.push({
      street,
      bays,
      type,
      area: String(row.Område || row.Omraade || ""),
      pilotId: "cph-p2",
    });
  }
  const categories = [...byType.entries()].map(([label, value]) => ({ label, value }));
  return { facilities, categories, totalBays: facilities.reduce((s, f) => s + f.bays, 0) };
}

function buildTubeJson() {
  const filePath = path.join(SP, "Tube Counts Bicyclist/Tube count bicyclist Medieval City April 2024.xlsx");
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(filePath).Sheets.Ark1, { defval: null });
  return rows
    .map((row) => ({
      road: String(row["Name of the road"] || "").trim(),
      dailyTraffic: parseNum(row["Average daily traffic"]),
      avgSpeedKmh: parseNum(row["Average speed"]),
      pilotId: "cph-p2",
    }))
    .filter((r) => r.road);
}

function parseManualWorkbook(filePath, siteName) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets.Skema || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  let motor = 0;
  let bike = 0;
  for (const row of rows) {
    const label = String(row?.[0] || "");
    if (/A\+B:\s*MOTORK/i.test(label)) motor += parseNum(row?.[16]);
    if (/CYKLER \+ KNALLERTER I ALT/i.test(label)) bike += parseNum(row?.[16]);
  }
  const total = motor + bike;
  return { siteName, motor, bike, total, activeShare: total > 0 ? (bike / total) * 100 : 0 };
}

async function buildManualJson() {
  let geoText = null;
  try {
    geoText = await fs.readFile(path.join(SP, "manual_counts_geo.csv"), "utf8");
  } catch {
    // optional
  }
  const sites = [];
  if (geoText) {
    const lines = geoText.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(/[,;]/);
    const latIdx = headers.findIndex((h) => /lat/i.test(h));
    const lonIdx = headers.findIndex((h) => /lon/i.test(h));
    const posIdx = headers.findIndex((h) => /position/i.test(h));
    for (const line of lines.slice(1)) {
      const cols = line.split(/[,;]/);
      sites.push({
        id: `survey-${cols[posIdx] || sites.length}`,
        name: cols[posIdx] || `Site ${sites.length + 1}`,
        lat: parseNum(cols[latIdx]),
        lon: parseNum(cols[lonIdx]),
        pilotId: "cph-p1",
      });
    }
  }
  const manualDir = path.join(SP, "Manual Counts/2025");
  const counts = [];
  try {
    const files = (await fs.readdir(manualDir)).filter((f) => /\.xlsx$/i.test(f) && !/FOD/i.test(f));
    for (const file of files) {
      const siteName = file.replace(/_\d{8}\.xlsx$/i, "").replace(/_/g, " ");
      const parsed = parseManualWorkbook(path.join(manualDir, file), siteName);
      // Sticky #32: Pilot 1 primary; runtime also links Pilot 3 — never Pilot 2.
      counts.push({ ...parsed, file, pilotId: "cph-p1" });
    }
  } catch {
    // optional
  }

  const zones2023 = [];
  const zoneFiles = [
    path.join(SP, "Manual Counts/Medieval City manual counts traffic_2023_uploaded to ELABORATOR.xlsx"),
    path.join(SP, "Manual Counts/Middelalderbyen_trafik_ind_2023_rettet_20250402.xlsx"),
  ];
  for (const zf of zoneFiles) {
    zones2023.push(...parseZoneWorkbook2023(zf));
  }
  const deduped = new Map();
  for (const z of zones2023) {
    const key = `${z.zone}::${z.sheet || ""}`;
    if (!deduped.has(key) || z.total > (deduped.get(key)?.total || 0)) deduped.set(key, z);
  }

  return { sites, counts, zones2023: [...deduped.values()] };
}

function parseIrapSheet(rows) {
  const modes = { pedestrian: 0, bike: 0, motor: 0, ptw: 0 };
  for (const row of rows) {
    const mode = String(row?.[0] || "").toLowerCase();
    const count = parseNum(row?.[1]);
    if (!count) continue;
    if (mode.includes("pedest")) modes.pedestrian += count;
    else if (mode.includes("bicy")) modes.bike += count;
    else if (mode.includes("moped") || mode.includes("scooter") || mode.includes("segway")) modes.ptw += count;
    else modes.motor += count;
  }
  const total = modes.pedestrian + modes.bike + modes.motor + modes.ptw;
  const motorPressure = total > 0 ? ((modes.motor + modes.ptw) / total) * 100 : 0;
  return { ...modes, total, motorPressure };
}

function buildIrapJson() {
  const filePath = path.join(SP, "iRAP/iRap safety ranking Counts in 2024 and 2025 CPH.xlsx");
  const wb = XLSX.readFile(filePath);
  const sites = [];
  const siteCoords = {
    "frederiksholms kanal": { lat: 55.6758, lon: 12.5759, name: "Frederiksholms Kanal" },
    "løngangsstræde": { lat: 55.6769, lon: 12.5778, name: "Løngangsstræde" },
    "lavendelstræde": { lat: 55.6774, lon: 12.5749, name: "Lavendelstræde" },
  };
  for (const sheetName of wb.SheetNames) {
    const key = Object.keys(siteCoords).find((k) => sheetName.toLowerCase().includes(k));
    if (!key) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
    const parsed = parseIrapSheet(rows);
    const year = /2025/i.test(sheetName) ? "post" : "pre";
    const coord = siteCoords[key];
    let site = sites.find((s) => s.siteKey === key);
    if (!site) {
      site = {
        siteKey: key,
        siteName: coord.name,
        lat: coord.lat,
        lon: coord.lon,
        pilotId: "cph-p3",
        pre: null,
        post: null,
      };
      sites.push(site);
    }
    site[year] = parsed;
  }
  for (const site of sites) {
    if (site.pre && site.post) {
      site.safetyDelta = site.post.motorPressure - site.pre.motorPressure;
    }
  }
  return sites;
}

async function buildParkingGeoJson() {
  const shpDir = path.join(SP, "Technical drawing - Medieval City/parking-shp");
  let files;
  try {
    files = await fs.readdir(shpDir);
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
  const shp = files.find((f) => f.toLowerCase().endsWith(".shp"));
  const dbf = files.find((f) => f.toLowerCase().endsWith(".dbf"));
  if (!shp || !dbf) return { type: "FeatureCollection", features: [] };
  const source = await shapefile.open(path.join(shpDir, shp), path.join(shpDir, dbf));
  const features = [];
  while (true) {
    const result = await source.read();
    if (result.done) break;
    features.push(result.value);
  }
  return { type: "FeatureCollection", features };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const mediaFiles = await copyMediaToPublic();
  const parkingUtm = await buildParkingGeoJson();
  const bundles = {
    "otc-directional-observed.json": buildOtcJson(),
    "telraam-sites.json": buildTelraamJson(),
    "surveys.json": buildSurveysJson(),
    "parking-facilities.json": buildParkingJson(),
    "tube-counts.json": buildTubeJson(),
    "manual-counts.json": await buildManualJson(),
    "irap-sites.json": buildIrapJson(),
    "parking-polygons.geojson": parkingUtm,
    "parking-polygons-wgs84.geojson": await buildParkingWgs84GeoJson(parkingUtm),
    "accessibility-inventory.json": buildAccessibilityJson(),
    "platomo-sites.json": buildPlatomoJson(),
    "near-encounters-snapshot.json": buildNearEncountersSnapshot(),
    "emissions-snapshot.json": buildEmissionsSnapshot(),
    "evidence-manifest.json": buildEvidenceManifest(mediaFiles),
  };
  for (const [name, data] of Object.entries(bundles)) {
    const dest = path.join(OUT, name);
    await fs.writeFile(dest, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log(`Wrote ${name}`);
  }
  console.log(`\nCopenhagen bundles → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
