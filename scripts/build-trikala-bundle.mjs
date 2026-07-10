#!/usr/bin/env node
/**
 * Build committed Trikala bundles from extracted SharePoint mirror.
 * Run: npm run extract-sharepoint && npm run build-trikala-bundle
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP = path.join(ROOT, "public", "sharepoint-data", "Trikala");
const OUT = path.join(ROOT, "public", "data", "trikala");
/** Keep in sync with src/lib/trikalaMapConfig.ts TRIKALA_WORKSHOP_MAP_EMBED_URL */
const TRIKALA_WORKSHOP_MAP_EMBED_URL =
  "https://www.google.com/maps/d/embed?mid=1ka243QkLKE2l0RjGcAtum9YF1BbgP0Y&ehbc=2E312F";
/** GitHub rejects blobs over 100 MB — skip oversized docs when building committed bundles. */
const MAX_BUNDLE_BYTES = 95 * 1024 * 1024;

const SURVEY_FILES = {
  womenMobility: "ELABORATOR_ Women Mobility Questionnaire (Responses).xlsx",
  bikeLaneBaseline: "baseline data on bike safety from the on line syrvey_english.xlsx",
};

function resolveSheet(workbook) {
  const preferred = workbook.SheetNames.find((n) =>
    /form responses|απαντήσεις φόρμας|sheet1/i.test(n)
  );
  return preferred ?? workbook.SheetNames[0];
}

function loadRows(filename) {
  const full = path.join(SP, filename);
  try {
    const wb = XLSX.readFile(full);
    const sheet = resolveSheet(wb);
    return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });
  } catch {
    return [];
  }
}

function findKey(row, match) {
  return Object.keys(row).find((k) => match.test(k));
}

function avgLikert(rows, match) {
  const values = [];
  rows.forEach((row) => {
    const key = findKey(row, match);
    if (!key) return;
    const num = Number.parseFloat(String(row[key]).replace(",", "."));
    if (Number.isFinite(num) && num > 0) values.push(num);
  });
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function pctYes(rows, match) {
  if (!rows.length) return 0;
  let hits = 0;
  rows.forEach((row) => {
    const key = findKey(row, match);
    if (!key) return;
    const text = String(row[key]).toLowerCase();
    if (/^(ναι|yes|y)/i.test(text) || text.includes("ναι")) hits += 1;
  });
  return (hits / rows.length) * 100;
}

async function copyDirFiles(srcSubdir, destSubdir, pattern) {
  const srcDir = path.join(SP, srcSubdir);
  const destDir = path.join(OUT, destSubdir);
  const copied = [];
  try {
    const files = await fs.readdir(srcDir);
    await fs.mkdir(destDir, { recursive: true });
    for (const file of files) {
      if (!pattern.test(file)) continue;
      const srcPath = path.join(srcDir, file);
      const stat = await fs.stat(srcPath);
      if (stat.size > MAX_BUNDLE_BYTES) {
        console.warn(`Skipping ${file} (${Math.round(stat.size / 1024 / 1024)} MB) — exceeds Git bundle limit`);
        continue;
      }
      await fs.copyFile(srcPath, path.join(destDir, file));
      copied.push(file);
    }
  } catch {
    // mirror may be absent in CI — keep committed bundles if present
  }
  return copied;
}

function buildEnvironmentalJson() {
  const filePath = path.join(SP, "smart_citizen_kit_environmental_metrics.xlsx");
  try {
    const wb = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const sensors = rows
      .map((row) => {
        const sensorId = Number.parseFloat(String(row.Sensor));
        if (!Number.isFinite(sensorId)) return null;
        const caps = ["CO2", "eCO2", "O3", "NO2", "PM1", "PM2.5", "PM4", "PM10", "Noise"].filter(
          (col) => String(row[col] ?? "").trim().toUpperCase() === "X"
        );
        return {
          sensorId,
          inOutdoor: String(row["In/outdoor"] ?? ""),
          status: String(row.Status ?? ""),
          capabilities: caps,
          capabilityScore: caps.length / 9,
          startingDate: row["Starting date"] ?? null,
          endingDate: row["Ending date"] ?? null,
        };
      })
      .filter(Boolean);
    const outdoor = sensors.filter((s) => /outdoor/i.test(s.inOutdoor));
    const outdoorOnline = outdoor.filter((s) => /online/i.test(s.status));
    return {
      generatedAt: new Date().toISOString(),
      sourceFile: "smart_citizen_kit_environmental_metrics.xlsx",
      sensorCount: sensors.length,
      outdoorCount: outdoor.length,
      outdoorOnlineCount: outdoorOnline.length,
      outdoorFleetCoveragePct:
        outdoor.length > 0 ? Math.round((outdoorOnline.length / outdoor.length) * 100) : 0,
      sensors,
      note: "Coordinates column empty in source workbook — map positions are inferred near pilot anchor.",
    };
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      sensorCount: 0,
      sensors: [],
      note: "Environmental workbook not extracted — run npm run extract-sharepoint.",
    };
  }
}

function buildSurveyInsightsJson() {
  const women = loadRows(SURVEY_FILES.womenMobility);
  const bike = loadRows(SURVEY_FILES.bikeLaneBaseline);
  return {
    generatedAt: new Date().toISOString(),
    womenMobility: {
      n: women.length,
      daySafetyAvg: avgLikert(women, /ασφαλής.*μέρα/i),
      nightSafetyAvg: avgLikert(women, /ασφαλής.*νύχτα/i),
      harassmentPct: pctYes(women, /παρενόχλησης|harassment/i),
      routeAvoidancePct: pctYes(women, /αποφεύγεις|avoid/i),
    },
    bikeLaneBaseline: {
      n: bike.length,
      laneSafetyAvg: avgLikert(bike, /safe.*bike lane/i),
      laneConditionAvg: avgLikert(bike, /condition of the bike lane/i),
      nightSafetyAvg: avgLikert(bike, /cycling at night/i),
    },
  };
}

function docTitle(file) {
  const base = file.replace(/\.[^.]+$/, "").replace(/_/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function buildEvidenceManifest(mediaFiles, docFiles) {
  const entries = [
    {
      id: "tri-p1-interventions",
      pilotId: "tri-p1",
      title: "Trikala ELABORATOR interventions",
      type: "narrative",
      linkedDatasetIds: [
        "tri-smart-crossing-survey",
        "tri-smart-crossing-post",
        "tri-bike-lane-baseline",
        "tri-bike-lane-post",
        "tri-smarta-app-post",
      ],
      linkedMethods: [
        "Smart crossing (1st intervention)",
        "Bike lane redesign (3rd intervention)",
        "SMARTA app (4th intervention)",
      ],
      fallback: {
        type: "narrative",
        text: "Three monitored interventions with baseline and/or post-intervention survey waves, plus partner workshop and deployment documentation from the June 2026 SharePoint drop.",
      },
    },
    {
      id: "tri-p1-women-survey",
      pilotId: "tri-p1",
      title: "Women mobility questionnaire",
      type: "narrative",
      linkedDatasetIds: ["tri-women-mobility-survey"],
      linkedMethods: ["Women mobility questionnaire"],
      fallback: {
        type: "narrative",
        text: "117 women respondents — caregiver segments, harassment and route-avoidance cross-tabs, and village vs urban mode-share patterns feed KPI 2.1 safety narratives.",
      },
    },
    {
      id: "tri-p1-environmental-fleet",
      pilotId: "tri-p1",
      title: "Smart Citizen Kit sensor fleet",
      type: "narrative",
      linkedDatasetIds: ["tri-environmental-sensors"],
      linkedMethods: ["Smart Citizen Kit environmental monitoring"],
      fallback: {
        type: "narrative",
        text: "19 Smart Citizen Kit sensors registered — outdoor online coverage and PM2.5/noise capability matrix feed KPI 3.2 monitoring proxies (coordinates not supplied in workbook).",
      },
    },
    {
      id: "tri-p2-park-ride-geodata",
      pilotId: "tri-p2",
      title: "Park & Ride hub polygons (SMY · DEH · GiSeMi)",
      type: "narrative",
      linkedDatasetIds: ["tri-partner-map-locations"],
      linkedMethods: ["Partner My Maps P+R polygons", "Municipal parking inventory"],
      fallback: {
        type: "narrative",
        text: "Partner polygon geodata integrated on the map. Structured P+R occupancy survey and mode-share counts pending the June 2026 partner drop — observatory mode-share values are illustrative intermodal proxies until then.",
      },
    },
    {
      id: "tri-p3-bike-lane-geodata",
      pilotId: "tri-p3",
      title: "Bike-lane sensor registry",
      type: "narrative",
      linkedDatasetIds: [
        "tri-partner-map-locations",
        "tri-bike-lane-baseline",
        "tri-bike-lane-post",
      ],
      linkedMethods: ["Redesigned bike lanes", "Bike safety survey baseline + post"],
      fallback: {
        type: "narrative",
        text: "30 partner bike-lane sensor nodes and paired safety surveys (n≈310 baseline). Per-sensor time-series not yet linked — map shows registry positions with survey aggregates at pilot anchor.",
      },
    },
    {
      id: "tri-p1-park-ride-pending",
      pilotId: "tri-p1",
      title: "Park & Ride (2nd intervention)",
      type: "narrative",
      linkedDatasetIds: ["tri-park-ride-locations"],
      linkedMethods: ["Park & Ride intervention"],
      fallback: {
        type: "narrative",
        text: "SMY, DEH, and GiSeMi Park&Ride hubs mapped from partner My Maps — survey workbook still pending in SharePoint drop.",
      },
    },
    {
      id: "tri-p1-women-workshop-audio",
      pilotId: "tri-p1",
      title: "Women cycling workshop — field interview audio",
      type: "narrative",
      linkedDatasetIds: ["tri-women-mobility-survey"],
      linkedMethods: ["Qualitative interviews"],
      fallback: {
        type: "narrative",
        text: "One .m4a field interview from the 2nd women cycling workshop is in the SharePoint zip but not bundled in the dashboard (audio-only qualitative asset).",
      },
    },
    {
      id: "tri-p1-meeting-attendance",
      pilotId: "tri-p1",
      title: "One2One city engagements — May 2025",
      type: "narrative",
      linkedDatasetIds: ["tri-meeting-attendance"],
      linkedMethods: ["Stakeholder meetings"],
      fallback: {
        type: "narrative",
        text: "17-row meeting attendance workbook documents ELABORATOR–E-Trikala engagement sessions (administrative, not mapped to KPI geometry).",
      },
    },
    {
      id: "tri-p1-women-workshop-maps",
      pilotId: "tri-p1",
      title: "Women workshops — route maps",
      type: "iframe",
      embedUrl: TRIKALA_WORKSHOP_MAP_EMBED_URL,
      linkedDatasetIds: ["tri-women-mobility-survey", "tri-docs-bundle"],
      linkedMethods: ["Participatory mapping"],
      caption:
        "Interactive e-Trikala workshop map — Park & Ride hubs, smart crossing corridors, and environmental sensor nodes.",
      fallback: {
        type: "narrative",
        text: "Interactive workshop route map unavailable — open the Google My Maps layer from the partner document portal.",
      },
    },
  ];

  const smartaImages = mediaFiles.filter((f) => /img_|smarta/i.test(f));
  if (smartaImages.length > 0) {
    entries.push({
      id: "tri-p1-smarta-deployment-photos",
      pilotId: "tri-p1",
      title: "SMARTA app deployment photos",
      type: "image",
      path: `/data/trikala/media/${smartaImages[0]}`,
      linkedDatasetIds: ["tri-smarta-app-post", "tri-media-gallery"],
      linkedMethods: ["SMARTA app deployment", "Field photography"],
      caption: `${smartaImages.length} deployment photos from the SMARTA app intervention folder.`,
      fallback: {
        type: "narrative",
        text: "SMARTA deployment photos not bundled — run extract-sharepoint and build-trikala-bundle.",
      },
    });
  }

  const docMatchers = [
    {
      test: /ccc.*commitments/i,
      id: "tri-p1-ccc-commitments",
      title: "Trikala CCC — Commitments",
      methods: ["Citizen change coalition"],
      datasets: ["tri-docs-bundle"],
    },
    {
      test: /ccc.*action/i,
      id: "tri-p1-ccc-action-plan",
      title: "Trikala CCC — Action plan",
      methods: ["Citizen change coalition"],
      datasets: ["tri-docs-bundle"],
    },
    {
      test: /sensorkit|sensor_kit/i,
      id: "tri-p1-sensor-kit-poster",
      title: "ELABORATOR sensor kit poster",
      methods: ["Smart Citizen Kit"],
      datasets: ["tri-environmental-sensors", "tri-docs-bundle"],
    },
    {
      test: /smart_crossing|smart.crossing/i,
      id: "tri-p1-smart-crossing-baseline-report",
      title: "Smart crossing baseline report",
      methods: ["Smart crossing survey"],
      datasets: ["tri-smart-crossing-survey", "tri-docs-bundle"],
    },
    {
      test: /bike.lane|bike_lanes/i,
      id: "tri-p1-bike-lane-baseline-report",
      title: "Bike lane safety baseline report",
      methods: ["Bike lane safety survey"],
      datasets: ["tri-bike-lane-baseline", "tri-docs-bundle"],
    },
    {
      test: /women.*questionnaire|women.*mobility/i,
      id: "tri-p1-women-mobility-analysis",
      title: "Women mobility analysis",
      methods: ["Women mobility questionnaire", "Qualitative analysis"],
      datasets: ["tri-women-mobility-survey", "tri-docs-bundle"],
    },
    {
      test: /evaluation.plan/i,
      id: "tri-p1-evaluation-plan",
      title: "Trikala intervention evaluation plan (draft)",
      methods: ["Evaluation framework"],
      datasets: ["tri-docs-bundle"],
    },
    {
      test: /smarta.*report|sustainable.urban.mobility/i,
      id: "tri-p1-smarta-survey-report",
      title: "SMARTA app survey results report",
      methods: ["SMARTA app post-intervention survey"],
      datasets: ["tri-smarta-app-post", "tri-docs-bundle"],
    },
    {
      test: /bike.sharing|municipal.bike/i,
      id: "tri-p1-bike-sharing-data",
      title: "Municipal bike sharing system data",
      methods: ["Bike sharing inventory"],
      datasets: ["tri-docs-bundle"],
    },
    {
      test: /workshop.*notes|exploratory.walk.*notes/i,
      id: "tri-p1-women-workshop-notes",
      title: "Women workshops — field notes",
      methods: ["Explorative walks", "Women workshops"],
      datasets: ["tri-women-mobility-survey", "tri-docs-bundle"],
    },
    {
      test: /participant.list/i,
      id: "tri-p1-women-workshop-participants",
      title: "Women workshops — participant lists",
      methods: ["Workshop administration"],
      datasets: ["tri-women-mobility-survey", "tri-docs-bundle"],
    },
    {
      test: /participants\.daily\.routes/i,
      id: "tri-p1-women-workshop-maps",
      title: "Women workshops — route maps",
      methods: ["Participatory mapping"],
      datasets: ["tri-women-mobility-survey", "tri-docs-bundle"],
    },
    {
      test: /meeting.notes|transcript/i,
      id: "tri-p1-engagement-transcript",
      title: "E-Trikala engagement notes & transcript",
      methods: ["One2One city engagements"],
      datasets: ["tri-meeting-attendance", "tri-docs-bundle"],
    },
  ];

  for (const file of docFiles) {
    const matcher = docMatchers.find((m) => m.test.test(file));
    if (!matcher) continue;
    if (entries.some((e) => e.id === matcher.id)) continue;
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".pdf" ? "pdf" : "pdf";
    entries.push({
      id: matcher.id,
      pilotId: "tri-p1",
      title: matcher.title,
      type,
      path: `/data/trikala/docs/${file}`,
      linkedDatasetIds: matcher.datasets,
      linkedMethods: matcher.methods,
      caption: docTitle(file),
      fallback: {
        type: "narrative",
        text: `${matcher.title} not bundled — run extract-sharepoint and build-trikala-bundle.`,
      },
    });
  }

  for (const file of docFiles) {
    if (entries.some((e) => e.path === `/data/trikala/docs/${file}`)) continue;
    const ext = path.extname(file).toLowerCase();
    if (!/\.(pdf|docx|pptx)$/i.test(ext)) continue;
    entries.push({
      id: `tri-p1-doc-${file.replace(/\.[^.]+$/, "")}`,
      pilotId: "tri-p1",
      title: docTitle(file),
      type: "pdf",
      path: `/data/trikala/docs/${file}`,
      linkedDatasetIds: ["tri-docs-bundle"],
      linkedMethods: ["Partner documentation"],
      caption: docTitle(file),
      fallback: { type: "narrative", text: "Document unavailable in committed bundle." },
    });
  }

  return entries;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const mediaFiles = await copyDirFiles("media", "media", /\.(jpg|jpeg|png)$/i);
  const docFiles = await copyDirFiles("docs", "docs", /\.(pdf|docx|pptx)$/i);

  const bundles = {
    "survey-insights.json": buildSurveyInsightsJson(),
    "environmental-sensors.json": buildEnvironmentalJson(),
    "evidence-manifest.json": buildEvidenceManifest(mediaFiles, docFiles),
  };

  for (const [name, data] of Object.entries(bundles)) {
    const dest = path.join(OUT, name);
    await fs.writeFile(dest, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log(`Wrote ${name}`);
  }

  console.log(
    `\nTrikala bundles → ${OUT} (${mediaFiles.length} images, ${docFiles.length} docs)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
