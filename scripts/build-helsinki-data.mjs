#!/usr/bin/env node
/**
 * Ingest the Helsinki Lighthouse SharePoint drop into a committed data package:
 * - public/sharepoint-data/Helsinki/  (gitignored local mirror of raw extracts)
 * - public/data/helsinki/*.json + *.geojson (committed, browser-safe)
 *
 * Usage: npm run build-helsinki-data
 */
import fs from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { execSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DROP_DIR = path.join(ROOT, "public", "Sharepoint_Datasets_06_2026");
const HEL_ZIP_CANDIDATES = [
  path.join(DROP_DIR, "Helsinki-20260625T113855Z-3-001.zip"),
  path.join(DROP_DIR, "Helsinki Lighthouse-20260625T113858Z-3-001.zip"),
];
const SP = path.join(ROOT, "public", "sharepoint-data", "Helsinki");
const OUT = path.join(ROOT, "public", "data", "helsinki");

function resolveHelsinkiZip() {
  for (const candidate of HEL_ZIP_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function listZipMembers(zipPath) {
  const output = execSync(`tar -tf "${zipPath}"`, { encoding: "utf8", maxBuffer: 80 * 1024 * 1024 });
  return output.split(/\r?\n/).filter(Boolean);
}

async function extractMember(zipPath, member, destPath) {
  const tempDir = path.join(SP, ".extract-tmp", path.basename(zipPath, ".zip"));
  await fs.mkdir(tempDir, { recursive: true });
  const quoted = member.includes(" ") ? `"${member}"` : member;
  execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, { stdio: "pipe", maxBuffer: 80 * 1024 * 1024 });
  const extracted = path.join(tempDir, member);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.copyFile(extracted, destPath);
}

async function findFileRecursive(dir, predicate) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFileRecursive(full, predicate);
      if (found) return found;
    } else if (predicate(entry.name)) {
      return full;
    }
  }
  return null;
}

/**
 * Some zip members have non-ASCII (Finnish) filenames that libarchive's own `-t` listing
 * mangles under Node's utf8 decoding, so re-quoting the listed name for `-x` round-trips
 * to an ENOENT. Wildcard extraction (glob, matched internally by tar/libarchive against the
 * archive's own raw bytes) sidesteps the encoding mismatch entirely.
 */
async function extractGlob(zipPath, glob, destPath, filePredicate) {
  const tempDir = path.join(SP, ".extract-tmp", `glob-${path.basename(destPath).replace(/[^a-z0-9]/gi, "_")}`);
  await fs.mkdir(tempDir, { recursive: true });
  execSync(`tar -xf "${zipPath}" -C "${tempDir}" "${glob}"`, { stdio: "pipe", maxBuffer: 80 * 1024 * 1024 });
  const found = await findFileRecursive(tempDir, filePredicate);
  if (!found) throw new Error(`glob extraction produced no match for ${glob}`);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.copyFile(found, destPath);
  await fs.rm(tempDir, { recursive: true, force: true });
}

/** Direct member -> destination mappings (small/medium files, safe to tar -x directly). */
function directExtractions(root) {
  return [
    { match: /^Helsinki\/Data from Helsinki\/Telraam\/raw-data-9000007091-16eb11c\.xlsx$/, dest: "Telraam/raw-data-9000007091-16eb11c.xlsx" },
    { match: /^Helsinki\/Data from Helsinki\/Telraam\/raw-data-9000007091-79245e\.xlsx$/, dest: "Telraam/raw-data-9000007091-79245e.xlsx" },
    { match: /^Helsinki\/DangerousLocationsSurvey_ENG_EPSG3067\.gpkg$/, dest: "DangerousLocationsSurvey_ENG_EPSG3067.gpkg" },
    { match: /^Helsinki\/Helsinki_Intervention_Locations_EPSG3067\.gpkg$/, dest: "Helsinki_Intervention_Locations_EPSG3067.gpkg" },
    { match: /^Helsinki\/Data from Helsinki\/Helsinki_eScooter_Observations\.zip$/, dest: "Helsinki_eScooter_Observations.zip" },
    { match: /^Helsinki\/Data from Helsinki\/DangerousLocationsSurvey2\.zip$/, dest: "DangerousLocationsSurvey2.zip" },
    { glob: "Helsinki/Data from Helsinki/ENGLISH*", filePredicate: (name) => /\.xlsx$/i.test(name), dest: "viikki-ux-survey.xlsx" },
    { match: /^Helsinki\/Data from Helsinki\/HSL data\/2015_20250609\.geoparquet$/, dest: "hsl-tram15-2025-06-09.geoparquet" },
    { match: /^Helsinki\/Data from Helsinki\/Viikki Innotrafik warning system\/alarm_durations_boxplot\.png$/, dest: "innotrafik/alarm_durations_boxplot.png" },
    { match: /^Helsinki\/Data from Helsinki\/Viikki Innotrafik warning system\/alarm_durations_histogram_20250601_20250614\.png$/, dest: "innotrafik/alarm_durations_histogram_20250601_20250614.png" },
    { match: /^Helsinki\/Data from Helsinki\/Viikki Innotrafik warning system\/alarm_durations_histogram_20250701_20250714\.png$/, dest: "innotrafik/alarm_durations_histogram_20250701_20250714.png" },
    { match: /^Helsinki\/Data from Helsinki\/Viikki Innotrafik warning system\/alarm_durations_histogram_20250801_20250814\.png$/, dest: "innotrafik/alarm_durations_histogram_20250801_20250814.png" },
    { match: /^Helsinki\/Data from Helsinki\/Viikki Innotrafik warning system\/alarm_heatmap_weekday_minute\.png$/, dest: "innotrafik/alarm_heatmap_weekday_minute.png" },
    { match: /^Helsinki\/Data from Helsinki\/Viikki lidar raw data sample\/Viikintie_sample_2024103_1006_OS-1-128_122341000441\.json$/, dest: "lidar-sample-metadata.json" },
  ];
}

async function extractDirect(zipPath, members) {
  const results = [];
  for (const item of directExtractions(ROOT)) {
    const destPath = path.join(SP, item.dest);
    try {
      if (item.glob) {
        await extractGlob(zipPath, item.glob, destPath, item.filePredicate);
      } else {
        const member = members.find((m) => item.match.test(m));
        if (!member) {
          results.push({ label: item.dest, status: "missing" });
          continue;
        }
        await extractMember(zipPath, member, destPath);
      }
      results.push({ label: item.dest, status: "ok", bytes: statSync(destPath).size });
      console.log(`OK  ${item.dest}`);
    } catch (err) {
      results.push({ label: item.dest, status: "error", error: String(err) });
      console.error(`ERR ${item.dest}: ${err}`);
    }
  }
  return results;
}

/** Unpack the nested Helsinki_eScooter_Observations.zip (small) into escooter-src/. */
async function unpackEscooterZip() {
  const nested = path.join(SP, "Helsinki_eScooter_Observations.zip");
  if (!existsSync(nested)) return { status: "missing" };
  const outDir = path.join(SP, "escooter-src");
  await fs.mkdir(outDir, { recursive: true });
  execSync(`tar -xf "${nested}" -C "${outDir}"`, { stdio: "pipe" });
  const files = (await fs.readdir(outDir)).filter((f) => f.endsWith(".gpkg"));
  console.log(`OK  escooter-src (${files.length} gpkg layers)`);
  return { status: "ok", files };
}

/** Unpack yleiset.xlsx (citywide safety-attitude survey) from the nested DangerousLocationsSurvey2.zip. */
async function unpackYleiset() {
  const nested = path.join(SP, "DangerousLocationsSurvey2.zip");
  if (!existsSync(nested)) return { status: "missing" };
  const tempDir = path.join(SP, ".extract-tmp", "dangerous-survey2");
  await fs.mkdir(tempDir, { recursive: true });
  execSync(`tar -xf "${nested}" -C "${tempDir}" yleiset.xlsx`, { stdio: "pipe" });
  const dest = path.join(SP, "yleiset.xlsx");
  await fs.copyFile(path.join(tempDir, "yleiset.xlsx"), dest);
  console.log("OK  yleiset.xlsx (citywide safety-attitude survey)");
  return { status: "ok" };
}

/**
 * Unpack only the small Viikki_2024-10-03 gate-count workbooks (vehicle/bike/pedestrian/VRU)
 * from the large (~1.1GB) nested Mobilysis zip, without shipping trajectories/imagery/CSVs.
 */
async function unpackMobilysisGateCounts(zipPath, members) {
  const nestedMember = members.find((m) =>
    /^Helsinki\/Data from Helsinki\/Viikki traffic trajectories\/Mobilysis_analyysi_kaikki-aineisto-kayta-tata_20250808\.zip$/.test(
      m
    )
  );
  if (!nestedMember) return { status: "missing" };

  const nestedZipTemp = path.join(SP, ".extract-tmp", "mobilysis-nested.zip");
  await fs.mkdir(path.dirname(nestedZipTemp), { recursive: true });
  console.log("...extracting nested Mobilysis zip (~1.1GB, one-time)");
  execSync(`tar -xf "${zipPath}" -C "${path.dirname(nestedZipTemp)}" "${nestedMember}"`, {
    stdio: "pipe",
    maxBuffer: 200 * 1024 * 1024,
  });
  const extractedNested = path.join(path.dirname(nestedZipTemp), nestedMember);

  const gateCountMembers = listZipMembers(extractedNested).filter(
    (m) =>
      m.replace(/\\/g, "/").startsWith("Viikki_2024-10-03/") &&
      /(updated_bikes_counts|updated_pedestrian_counts|vehicle_counts|vru_counts)\//.test(m.replace(/\\/g, "/")) &&
      /\.xlsx$/i.test(m)
  );

  const outDir = path.join(SP, "mobilysis-viikki");
  await fs.mkdir(outDir, { recursive: true });
  const written = [];
  for (const member of gateCountMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    execSync(`tar -xf "${extractedNested}" -C "${path.dirname(nestedZipTemp)}" ${quoted}`, {
      stdio: "pipe",
      maxBuffer: 50 * 1024 * 1024,
    });
    const src = path.join(path.dirname(nestedZipTemp), member);
    const dest = path.join(outDir, path.basename(member));
    await fs.copyFile(src, dest);
    written.push(path.basename(member));
  }

  // Clean up the large nested zip + working tree so it doesn't linger on disk.
  await fs.rm(path.join(path.dirname(nestedZipTemp), "Helsinki"), { recursive: true, force: true });
  await fs.rm(extractedNested, { force: true }).catch(() => {});

  console.log(`OK  mobilysis-viikki (${written.length} gate-count workbooks)`);
  return { status: "ok", files: written };
}

function readWorkbookRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const out = {};
  for (const sheetName of workbook.SheetNames) {
    out[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  }
  return out;
}

const VIIKKI_LAT = 60.224599;
const VIIKKI_LNG = 25.017236;

function parseTelraamWorkbook(filePath, sourceLabel) {
  const sheets = readWorkbookRows(filePath);
  const rows = sheets[Object.keys(sheets)[0]];
  const byDay = new Map();
  let totalPed = 0;
  let totalBike = 0;
  let totalCar = 0;
  let totalHeavy = 0;
  let speedSum = 0;
  let speedCount = 0;
  let minDate = null;
  let maxDate = null;

  for (const row of rows) {
    const rawDate = row["Date and Time (Local)"];
    if (!rawDate) continue;
    const date = rawDate instanceof Date ? rawDate : new Date(String(rawDate).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) continue;
    const day = date.toISOString().slice(0, 10);
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;

    const ped = Number(row["Pedestrian Total"]) || 0;
    const bike = Number(row["Bike Total"]) || 0;
    const car = Number(row["Car Total"]) || 0;
    const heavy = Number(row["Large vehicle Total"]) || 0;
    const speed = Number(row["Speed V85 km/h"]);

    totalPed += ped;
    totalBike += bike;
    totalCar += car;
    totalHeavy += heavy;
    if (Number.isFinite(speed) && speed > 0) {
      speedSum += speed;
      speedCount += 1;
    }

    const bucket = byDay.get(day) || { date: day, pedestrian: 0, bike: 0, car: 0, heavy: 0, speedSum: 0, speedCount: 0 };
    bucket.pedestrian += ped;
    bucket.bike += bike;
    bucket.car += car;
    bucket.heavy += heavy;
    if (Number.isFinite(speed) && speed > 0) {
      bucket.speedSum += speed;
      bucket.speedCount += 1;
    }
    byDay.set(day, bucket);
  }

  const daily = Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      pedestrian: d.pedestrian,
      bike: d.bike,
      car: d.car,
      heavy: d.heavy,
      total: d.pedestrian + d.bike + d.car + d.heavy,
      v85SpeedKmh: d.speedCount > 0 ? Math.round((d.speedSum / d.speedCount) * 10) / 10 : null,
    }));

  const grandTotal = totalPed + totalBike + totalCar + totalHeavy;
  return {
    sensorId: "9000007091",
    street: "Koetilantie",
    city: "Helsinki",
    location: { lat: VIIKKI_LAT, lng: VIIKKI_LNG, note: "Fixed Viikintie-Koetilantie tramway crossing anchor (FVH3)" },
    periodStart: minDate ? minDate.toISOString() : null,
    periodEnd: maxDate ? maxDate.toISOString() : null,
    totals: { pedestrian: totalPed, bike: totalBike, car: totalCar, heavy: totalHeavy, all: grandTotal },
    modeShare: {
      pedestrianPct: grandTotal > 0 ? Math.round((totalPed / grandTotal) * 1000) / 10 : 0,
      bikePct: grandTotal > 0 ? Math.round((totalBike / grandTotal) * 1000) / 10 : 0,
      carPct: grandTotal > 0 ? Math.round((totalCar / grandTotal) * 1000) / 10 : 0,
      heavyPct: grandTotal > 0 ? Math.round((totalHeavy / grandTotal) * 1000) / 10 : 0,
    },
    v85SpeedKmh: speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : null,
    dailyAggregates: daily,
    source: sourceLabel,
    sourceFile: path.basename(filePath),
  };
}

function mergeTelraamSensors(sensors) {
  if (!sensors.length) return null;
  const byDay = new Map();
  let minDate = null;
  let maxDate = null;

  for (const sensor of sensors) {
    if (sensor.periodStart && (!minDate || sensor.periodStart < minDate)) minDate = sensor.periodStart;
    if (sensor.periodEnd && (!maxDate || sensor.periodEnd > maxDate)) maxDate = sensor.periodEnd;
    for (const d of sensor.dailyAggregates) {
      const bucket = byDay.get(d.date) || {
        date: d.date,
        pedestrian: 0,
        bike: 0,
        car: 0,
        heavy: 0,
        speedSum: 0,
        speedCount: 0,
      };
      bucket.pedestrian += d.pedestrian;
      bucket.bike += d.bike;
      bucket.car += d.car;
      bucket.heavy += d.heavy;
      if (d.v85SpeedKmh != null) {
        bucket.speedSum += d.v85SpeedKmh;
        bucket.speedCount += 1;
      }
      byDay.set(d.date, bucket);
    }
  }

  const daily = Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      pedestrian: d.pedestrian,
      bike: d.bike,
      car: d.car,
      heavy: d.heavy,
      total: d.pedestrian + d.bike + d.car + d.heavy,
      v85SpeedKmh: d.speedCount > 0 ? Math.round((d.speedSum / d.speedCount) * 10) / 10 : null,
    }));

  const totals = daily.reduce(
    (t, d) => ({
      pedestrian: t.pedestrian + d.pedestrian,
      bike: t.bike + d.bike,
      car: t.car + d.car,
      heavy: t.heavy + d.heavy,
      all: t.all + d.total,
    }),
    { pedestrian: 0, bike: 0, car: 0, heavy: 0, all: 0 }
  );
  const grandTotal = totals.all;
  let speedSum = 0;
  let speedCount = 0;
  for (const d of daily) {
    if (d.v85SpeedKmh != null) {
      speedSum += d.v85SpeedKmh;
      speedCount += 1;
    }
  }

  return {
    sensorId: "9000007091",
    street: "Koetilantie",
    city: "Helsinki",
    location: { lat: VIIKKI_LAT, lng: VIIKKI_LNG, note: "Fixed Viikintie-Koetilantie tramway crossing anchor (FVH3)" },
    periodStart: minDate,
    periodEnd: maxDate,
    totals,
    modeShare: {
      pedestrianPct: grandTotal > 0 ? Math.round((totals.pedestrian / grandTotal) * 1000) / 10 : 0,
      bikePct: grandTotal > 0 ? Math.round((totals.bike / grandTotal) * 1000) / 10 : 0,
      carPct: grandTotal > 0 ? Math.round((totals.car / grandTotal) * 1000) / 10 : 0,
      heavyPct: grandTotal > 0 ? Math.round((totals.heavy / grandTotal) * 1000) / 10 : 0,
    },
    v85SpeedKmh: speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : null,
    dailyAggregates: daily,
    source: "SharePoint Helsinki/Telraam/raw-data-9000007091-*.xlsx (KPI 1.2)",
  };
}

function buildTelraamKoetilantie() {
  const files = [
    path.join(SP, "Telraam", "raw-data-9000007091-16eb11c.xlsx"),
    path.join(SP, "Telraam", "raw-data-9000007091-79245e.xlsx"),
  ].filter(existsSync);
  if (files.length === 0) return null;
  const sensors = files.map((filePath) =>
    parseTelraamWorkbook(filePath, "SharePoint Helsinki/Telraam/raw-data-9000007091-*.xlsx (KPI 1.2)")
  );
  return mergeTelraamSensors(sensors);
}

function buildTelraamSensorsBundle() {
  const files = [
    path.join(SP, "Telraam", "raw-data-9000007091-16eb11c.xlsx"),
    path.join(SP, "Telraam", "raw-data-9000007091-79245e.xlsx"),
  ].filter(existsSync);
  if (files.length === 0) return null;
  const sensors = files.map((filePath) =>
    parseTelraamWorkbook(filePath, "SharePoint Helsinki/Telraam/raw-data-9000007091-*.xlsx (KPI 1.2)")
  );
  const merged = buildTelraamKoetilantie();
  if (!merged) return null;
  return {
    merged,
    sensors,
    note: "One physical Telraam sensor (9000007091) with two SharePoint workbook exports merged for the full observation window.",
  };
}

function buildInnotrafikAlarmSummary() {
  const innotrafikDir = path.join(SP, "innotrafik");
  if (!existsSync(innotrafikDir)) return null;

  const periods = [
    {
      label: "Jun 2025 (days 1–14)",
      startDate: "2025-06-01",
      endDate: "2025-06-14",
      relativeIntensity: 62,
      chartPath: "/sharepoint-data/Helsinki/innotrafik/alarm_durations_histogram_20250601_20250614.png",
    },
    {
      label: "Jul 2025 (days 1–14)",
      startDate: "2025-07-01",
      endDate: "2025-07-14",
      relativeIntensity: 71,
      chartPath: "/sharepoint-data/Helsinki/innotrafik/alarm_durations_histogram_20250701_20250714.png",
    },
    {
      label: "Aug 2025 (days 1–14)",
      startDate: "2025-08-01",
      endDate: "2025-08-14",
      relativeIntensity: 68,
      chartPath: "/sharepoint-data/Helsinki/innotrafik/alarm_durations_histogram_20250801_20250814.png",
    },
  ];

  return {
    location: "Viikintie-Koetilantie tramway crossing (Innotrafik warning system)",
    coordinates: { lat: VIIKKI_LAT, lng: VIIKKI_LNG },
    periods,
    weekdayMinutePeaks: [
      { weekday: "Mon", minuteOfDay: 480, relativeIntensity: 78 },
      { weekday: "Tue", minuteOfDay: 510, relativeIntensity: 82 },
      { weekday: "Wed", minuteOfDay: 495, relativeIntensity: 80 },
      { weekday: "Thu", minuteOfDay: 505, relativeIntensity: 76 },
      { weekday: "Fri", minuteOfDay: 450, relativeIntensity: 74 },
    ],
    medianDurationSec: null,
    note: "Relative intensities are chart-derived proxies until the raw Innotrafik alarm-event table is delivered. PNG evidence charts remain in evidence-manifest.json media.innotrafik.",
    source: "SharePoint Helsinki/Viikki Innotrafik warning system/*.png (structured summary for map + observatory)",
  };
}

async function buildJsonOutputs(extractResults = []) {
  await fs.mkdir(OUT, { recursive: true });

  const telraam = buildTelraamKoetilantie();
  if (telraam) {
    await fs.writeFile(path.join(OUT, "telraam-koetilantie.json"), JSON.stringify(telraam, null, 2));
    console.log(`OK  telraam-koetilantie.json (${telraam.dailyAggregates.length} days)`);
  }

  const telraamSensors = buildTelraamSensorsBundle();
  if (telraamSensors) {
    await fs.writeFile(path.join(OUT, "telraam-sensors.json"), JSON.stringify(telraamSensors, null, 2));
    console.log(`OK  telraam-sensors.json (${telraamSensors.sensors.length} workbook exports)`);
  }

  const innotrafik = buildInnotrafikAlarmSummary();
  if (innotrafik) {
    await fs.writeFile(path.join(OUT, "innotrafik-alarm-summary.json"), JSON.stringify(innotrafik, null, 2));
    console.log(`OK  innotrafik-alarm-summary.json (${innotrafik.periods.length} periods)`);
  }

  const uxSurvey = buildViikkiUxSurvey();
  if (uxSurvey) {
    await fs.writeFile(path.join(OUT, "viikki-ux-survey.json"), JSON.stringify(uxSurvey, null, 2));
    console.log(`OK  viikki-ux-survey.json (${uxSurvey.totalResponses} responses, ${uxSurvey.overallSatisfiedPct}% satisfied)`);
  }

  const dangerousInsights = buildDangerousLocationsSurveyInsights();
  if (dangerousInsights) {
    await fs.writeFile(
      path.join(OUT, "dangerous-locations-survey-insights.json"),
      JSON.stringify(dangerousInsights, null, 2)
    );
    console.log(`OK  dangerous-locations-survey-insights.json (${dangerousInsights.totalRespondents} respondents)`);
  }

  const mobilysis = buildMobilysisGates();
  if (mobilysis) {
    await fs.writeFile(path.join(OUT, "mobilysis-viikki-gates.json"), JSON.stringify(mobilysis, null, 2));
    console.log(`OK  mobilysis-viikki-gates.json (${mobilysis.gateObservations.length} gate observations)`);
  }

  const manifest = await buildEvidenceManifest(extractResults);
  if (innotrafik) {
    manifest.pilots["hel-p3"].delivered.push("innotrafik-alarm-summary.json (chart-derived alarm intensity proxy)");
  }
  if (telraamSensors) {
    manifest.pilots["hel-p3"].delivered.push("telraam-sensors.json (per-workbook Telraam exports)");
  }
  await fs.writeFile(path.join(OUT, "evidence-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("OK  evidence-manifest.json");
}

const SATISFIED_VALUES = new Set(["Satisfied", "Very satisfied"]);
const NOTICED_PREFIX = "Yes";

function buildViikkiUxSurvey() {
  const filePath = path.join(SP, "viikki-ux-survey.xlsx");
  if (!existsSync(filePath)) return null;
  const sheets = readWorkbookRows(filePath);
  const rows = sheets[Object.keys(sheets)[0]] || [];

  const satisfactionQuestions = [
    "How satisfied would you be if similar warning systems were implemented at other light rail crossing points?",
    "How satisfied have you been with the functionality of the warning system?",
    "How satisfied have you been with the impact of the warning system on safety?",
    "How satisfied are you that the operation of the warning system has been initiated for testing?",
  ];
  const noticeQuestions = [
    "Have you noticed the traffic signs warning about the light rail crossing point?",
    "Have you noticed the sound warnings about an approaching light rail?",
    "Have you noticed the flashing yellow lights warning about an approaching light rail?",
  ];
  const feltUnsafeQuestion = "Have you ever felt that the Viikintie-Koetilantie light rail crossing point is unsafe to cross?";
  const accessibilityQuestion = "Do you have any visual, hearing, or mobility challenges that affect your perception or movement?";

  const validRows = rows.filter((r) => r[satisfactionQuestions[0]] != null);
  const totalResponses = validRows.length;

  function pctSatisfied(question) {
    const answered = validRows.filter((r) => r[question] != null && String(r[question]).trim() !== "");
    if (answered.length === 0) return null;
    const satisfied = answered.filter((r) => SATISFIED_VALUES.has(String(r[question]).trim()));
    return Math.round((satisfied.length / answered.length) * 1000) / 10;
  }
  function pctNoticed(question) {
    const answered = validRows.filter((r) => r[question] != null && String(r[question]).trim() !== "");
    if (answered.length === 0) return null;
    const noticed = answered.filter((r) => String(r[question]).trim().startsWith(NOTICED_PREFIX));
    return Math.round((noticed.length / answered.length) * 1000) / 10;
  }

  const satisfactionByQuestion = satisfactionQuestions.map((q) => ({ question: q, satisfiedPct: pctSatisfied(q) }));
  const overallSatisfiedPct =
    Math.round(
      (satisfactionByQuestion.reduce((sum, s) => sum + (s.satisfiedPct || 0), 0) / satisfactionByQuestion.length) * 10
    ) / 10;

  const feltUnsafeAnswered = validRows.filter((r) => r[feltUnsafeQuestion] != null);
  const feltUnsafePct =
    feltUnsafeAnswered.length > 0
      ? Math.round(
          (feltUnsafeAnswered.filter((r) => String(r[feltUnsafeQuestion]).trim() === "Yes").length /
            feltUnsafeAnswered.length) *
            1000
        ) / 10
      : null;

  const accessibilityAnswered = validRows.filter((r) => r[accessibilityQuestion] != null);
  const accessibilityChallengePct =
    accessibilityAnswered.length > 0
      ? Math.round(
          (accessibilityAnswered.filter((r) => String(r[accessibilityQuestion]).trim() === "Yes").length /
            accessibilityAnswered.length) *
            1000
        ) / 10
      : null;

  return {
    location: "Viikintie-Koetilantie tramway crossing (Viikki, FVH3)",
    totalResponses,
    kpi41Target: 75,
    overallSatisfiedPct,
    meetsKpi41Target: overallSatisfiedPct != null ? overallSatisfiedPct >= 75 : null,
    satisfactionByQuestion,
    noticedWarningSystemPct: {
      signs: pctNoticed(noticeQuestions[0]),
      sound: pctNoticed(noticeQuestions[1]),
      lights: pctNoticed(noticeQuestions[2]),
    },
    feltCrossingUnsafeBeforePct: feltUnsafePct,
    accessibilityChallengePct,
    source: "SharePoint Helsinki UX survey (ENGLISH Muokattu_käyttäjäkokemuskysely-viikki-2025-08-12.xlsx), KPI 4.1/4.2",
  };
}

const SAFETY_RATING_QUESTION =
  "Miten arvioisit liikenteen turvallisuutta Helsingissä yleisesti? (Pakollinen kysymys)";
const POSITIVE_SAFETY_RATINGS = new Set(["Erittäin turvallista", "Melko turvallista"]);
const NEGATIVE_SAFETY_RATINGS = new Set(["Erittäin turvatonta", "Melko turvatonta"]);

function buildDangerousLocationsSurveyInsights() {
  const filePath = path.join(SP, "yleiset.xlsx");
  if (!existsSync(filePath)) return null;
  const sheets = readWorkbookRows(filePath);
  const rows = sheets[Object.keys(sheets)[0]] || [];
  const answered = rows.filter((r) => r[SAFETY_RATING_QUESTION] != null && String(r[SAFETY_RATING_QUESTION]).trim() !== "");
  const positive = answered.filter((r) => POSITIVE_SAFETY_RATINGS.has(String(r[SAFETY_RATING_QUESTION]).trim()));
  const negative = answered.filter((r) => NEGATIVE_SAFETY_RATINGS.has(String(r[SAFETY_RATING_QUESTION]).trim()));

  return {
    title: "Citywide traffic safety perception survey (Kysely Helsingin liikenneturvallisuudesta)",
    totalRespondents: rows.length,
    answeredGeneralSafetyQuestion: answered.length,
    ratesTrafficSafetyPositivelyPct:
      answered.length > 0 ? Math.round((positive.length / answered.length) * 1000) / 10 : null,
    ratesTrafficSafetyNegativelyPct:
      answered.length > 0 ? Math.round((negative.length / answered.length) * 1000) / 10 : null,
    note:
      "Citywide (not FVH1-corridor-specific) attitude survey feeding the same Evaluation Plan; underpins KPI 3.2 policy-alignment narrative alongside the 2,663 dangerous-location + 3,202 conflict point submissions.",
    source: "SharePoint Helsinki/DangerousLocationsSurvey2.zip -> yleiset.xlsx",
  };
}

const MOBILYSIS_GATES = [
  { file: "Viikki_2024-10-03_counts_veh_rb_entry_ktt.xlsx", mode: "vehicle", gate: "rb_entry_ktt" },
  { file: "Viikki_2024-10-03_counts_veh_rb_entry_ne.xlsx", mode: "vehicle", gate: "rb_entry_ne" },
  { file: "Viikki_2024-10-03_counts_veh_rb_entry_nw.xlsx", mode: "vehicle", gate: "rb_entry_nw" },
  { file: "Viikki_2024-10-03_counts_veh_rb_entry_w.xlsx", mode: "vehicle", gate: "rb_entry_w" },
  { file: "Viikki_2024-10-03_counts_veh_rb_exit_e.xlsx", mode: "vehicle", gate: "rb_exit_e" },
  { file: "Viikki_2024-10-03_counts_veh_rb_exit_ktt.xlsx", mode: "vehicle", gate: "rb_exit_ktt" },
  { file: "Viikki_2024-10-03_counts_veh_rb_exit_nw.xlsx", mode: "vehicle", gate: "rb_exit_nw" },
  { file: "Viikki_2024-10-03_counts_veh_rb_exit_w.xlsx", mode: "vehicle", gate: "rb_exit_w" },
  { file: "Viikki_2024-10-03_counts_ped_ktt_p_cross_e.xlsx", mode: "pedestrian", gate: "ktt_p_cross_e" },
  { file: "Viikki_2024-10-03_counts_ped_ktt_p_cross_w.xlsx", mode: "pedestrian", gate: "ktt_p_cross_w" },
  { file: "Viikki_2024-10-03_counts_ped_tc_east_e.xlsx", mode: "pedestrian", gate: "tc_east_e" },
  { file: "Viikki_2024-10-03_counts_ped_tc_east_w.xlsx", mode: "pedestrian", gate: "tc_east_w" },
  { file: "Viikki_2024-10-03_counts_ped_tc_west_e.xlsx", mode: "pedestrian", gate: "tc_west_e" },
  { file: "Viikki_2024-10-03_counts_ped_tc_west_w.xlsx", mode: "pedestrian", gate: "tc_west_w" },
  { file: "Viikki_2024-10-03_counts_bikes_ktt_p_cross_e.xlsx", mode: "bike", gate: "ktt_p_cross_e" },
  { file: "Viikki_2024-10-03_counts_bikes_ktt_p_cross_w.xlsx", mode: "bike", gate: "ktt_p_cross_w" },
  { file: "Viikki_2024-10-03_counts_bikes_tc_east_e.xlsx", mode: "bike", gate: "tc_east_e" },
  { file: "Viikki_2024-10-03_counts_bikes_tc_east_w.xlsx", mode: "bike", gate: "tc_east_w" },
  { file: "Viikki_2024-10-03_counts_bikes_tc_west_e.xlsx", mode: "bike", gate: "tc_west_e" },
  { file: "Viikki_2024-10-03_counts_bikes_tc_west_w.xlsx", mode: "bike", gate: "tc_west_w" },
  { file: "Viikki_2024-10-03_counts_vru_ktt_p_cross_e.xlsx", mode: "vru", gate: "ktt_p_cross_e" },
  { file: "Viikki_2024-10-03_counts_vru_ktt_p_cross_w.xlsx", mode: "vru", gate: "ktt_p_cross_w" },
  { file: "Viikki_2024-10-03_counts_vru_tc_east_e.xlsx", mode: "vru", gate: "tc_east_e" },
  { file: "Viikki_2024-10-03_counts_vru_tc_east_w.xlsx", mode: "vru", gate: "tc_east_w" },
  { file: "Viikki_2024-10-03_counts_vru_tc_west_e.xlsx", mode: "vru", gate: "tc_west_e" },
  { file: "Viikki_2024-10-03_counts_vru_tc_west_w.xlsx", mode: "vru", gate: "tc_west_w" },
];

function sumTotalColumn(sheets) {
  let total = 0;
  for (const sheetName of Object.keys(sheets)) {
    for (const row of sheets[sheetName]) {
      const value = Number(row.Total);
      if (Number.isFinite(value)) total += value;
    }
  }
  return total;
}

function buildMobilysisGates() {
  const dir = path.join(SP, "mobilysis-viikki");
  if (!existsSync(dir)) return null;
  const gates = [];
  for (const entry of MOBILYSIS_GATES) {
    const filePath = path.join(dir, entry.file);
    if (!existsSync(filePath)) continue;
    const sheets = readWorkbookRows(filePath);
    const total = sumTotalColumn(sheets);
    gates.push({ mode: entry.mode, gate: entry.gate, totalCount: total, windows: Object.keys(sheets).length });
  }
  if (gates.length === 0) return null;

  const byMode = {};
  for (const g of gates) {
    byMode[g.mode] = (byMode[g.mode] || 0) + g.totalCount;
  }

  return {
    location: "Viikki intersection (Viikintie/Koetilantie), 2024-10-03 AM survey period",
    coordinates: { lat: VIIKKI_LAT, lng: VIIKKI_LNG },
    gateObservations: gates,
    modeTotals: byMode,
    note: "Aggregated from Mobilysis short-duration gate-count workbooks (AM1-AM3 survey windows); full vehicle/pedestrian trajectory CSVs and gate photos are not shipped to the browser bundle.",
    source: "SharePoint Helsinki/Data from Helsinki/Viikki traffic trajectories/Mobilysis_*.zip (KPI 1.2/2.1 context)",
  };
}

async function buildEvidenceManifest(extractResults) {
  const innotrafikDir = path.join(SP, "innotrafik");
  const innotrafikFiles = existsSync(innotrafikDir) ? await fs.readdir(innotrafikDir) : [];
  const lidarMeta = existsSync(path.join(SP, "lidar-sample-metadata.json"))
    ? JSON.parse(await fs.readFile(path.join(SP, "lidar-sample-metadata.json"), "utf8"))
    : null;

  return {
    generatedAt: new Date().toISOString(),
    pilots: {
      "hel-p1": {
        label: "FVH1 — Accident / near-miss data",
        delivered: [
          "dangerous-locations.geojson (2,663 citizen-reported hazard locations)",
          "conflicts.geojson (3,202 citizen-reported near-miss/conflict points)",
          "Citywide safety-attitude survey aggregate (dangerous-locations-survey-insights.json)",
        ],
        pending: [
          "See.Sense connected-bike near-miss feed — not present in SharePoint drop",
          "ViaNova AI risk-scoring output — not present in SharePoint drop",
        ],
      },
      "hel-p2": {
        label: "FVH2 — E-scooter parking (Kallio)",
        delivered: [
          "escooter-observations.geojson (509 field observations across 5 categories)",
          "Kallio summer-streets baseline PDF + bachelor's thesis referenced as methodology",
        ],
        pending: ["20 planned e-scooter parking sensors — not delivered per Evaluation Plan (observation study only)"],
      },
      "hel-p3": {
        label: "FVH3 — Viikki tramway-crossing warning system",
        delivered: [
          "telraam-koetilantie.json (Telraam street counts, 2024-06 to 2025-09)",
          "viikki-ux-survey.json (50 completed UX responses vs 75% satisfaction target)",
          "mobilysis-viikki-gates.json (Mobilysis gate counts, 2024-10-03 AM survey)",
          "hsl-tram15-sample.json (HSL tram line 15 position sample, 2025-06-09)",
          `Innotrafik alarm-duration evidence charts (${innotrafikFiles.length} PNGs)`,
        ],
        pending: [
          "Innotrafik raw alarm-event table (only chart PNGs provided, not a structured export)",
          "Lidar raw .pcap (~647MB) intentionally not shipped; setup photo + sensor metadata referenced instead",
          "Full Mobilysis vehicle/pedestrian trajectory CSVs intentionally not shipped; gate-count aggregates only",
        ],
      },
    },
    media: {
      innotrafik: innotrafikFiles.map((f) => `/sharepoint-data/Helsinki/innotrafik/${f}`),
    },
    lidarSample: lidarMeta
      ? {
          sensorModel: lidarMeta.sensor_info?.prod_line ?? null,
          serialNumber: lidarMeta.sensor_info?.prod_sn ?? null,
          note: "Full .pcap capture (~647MB) stays out of the web bundle; only sensor metadata + a setup photo are referenced.",
        }
      : null,
    documentReferences: [
      "HELSINKI Intervention Evaluation Plan_DRAFT.docx",
      "Bachelors_Thesis_Matias_Innamaa (e-scooters in kallio).pdf",
      "kallion_kesakadut_havainnointi_ja_haastattelut_2024_ENNEN_raportti.pdf",
      "Hotspot_analysis_Mesimäki.pdf",
      "Helsinki_FVH3_Survey on user experience_Sep2025.pptx.pdf",
      "Viikki tramway crossing intervention.docx",
    ],
    extraction: extractResults,
  };
}

async function main() {
  let extractResults = [];
  const zipPath = resolveHelsinkiZip();
  if (!zipPath) {
    console.warn("WARN  Helsinki zip missing in public/Sharepoint_Datasets_06_2026 — skipping SharePoint extract");
  } else {
    console.log(`Using zip: ${path.basename(zipPath)}`);
    const members = listZipMembers(zipPath);
    extractResults = await extractDirect(zipPath, members);
    await unpackEscooterZip();
    await unpackYleiset();
    await unpackMobilysisGateCounts(zipPath, members);

    console.log("\n--- Running Python geospatial conversion ---");
    try {
      execFileSync("python", [path.join(ROOT, "scripts", "convert-helsinki-geodata.py")], {
        stdio: "inherit",
        cwd: ROOT,
      });
    } catch (err) {
      console.error("ERR  python conversion failed:", err.message);
    }
  }

  console.log("\n--- Building JSON aggregates ---");
  await buildJsonOutputs(extractResults);

  console.log("\nDone. Committed outputs in public/data/helsinki/");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
