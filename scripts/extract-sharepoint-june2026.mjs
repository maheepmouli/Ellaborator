#!/usr/bin/env node
/**
 * Extract dashboard-critical files from Sharepoint_Datasets_06_2026 zips
 * into public/sharepoint-data/ (gitignored local mirror).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DROP_DIR = path.join(ROOT, "public", "Sharepoint_Datasets_06_2026");
const OUT_DIR = path.join(ROOT, "public", "sharepoint-data");
const MANIFEST_PATH = path.join(OUT_DIR, "_manifest.json");

/** @type {{ zip: string; match: RegExp; dest: string; label: string }[]} */
const EXTRACTIONS = [
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Countings_Norreport_sortet\.xlsx$/i,
    dest: "Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Norreport_sortet.xlsx",
    label: "cph-otc-norreport",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Countings_Vandkunsten_sortet\.xlsx$/i,
    dest: "Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Vandkunsten_sortet.xlsx",
    label: "cph-otc-vandkunsten",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Countings_Gammeltorv_sortet\.xlsx$/i,
    dest: "Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Gammeltorv_sortet.xlsx",
    label: "cph-otc-gammeltorv",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Countings_Stormgade_sortet\.xlsx$/i,
    dest: "Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Stormgade_sortet.xlsx",
    label: "cph-otc-stormgade",
  },
  {
    zip: "Helsinki Lighthouse-20260625T113858Z-3-001.zip",
    match: /raw-data-9000007091-16eb11c\.xlsx$/i,
    dest: "Helsinki/Telraam/raw-data-9000007091-16eb11c.xlsx",
    label: "hel-telraam-1",
  },
  {
    zip: "Helsinki Lighthouse-20260625T113858Z-3-001.zip",
    match: /raw-data-9000007091-79245e\.xlsx$/i,
    dest: "Helsinki/Telraam/raw-data-9000007091-79245e.xlsx",
    label: "hel-telraam-2",
  },
  {
    zip: "Helsinki Lighthouse-20260625T113858Z-3-001.zip",
    match: /DangerousLocationsSurvey_ENG_EPSG3067\.gpkg$/i,
    dest: "Helsinki/DangerousLocationsSurvey_ENG_EPSG3067.gpkg",
    label: "hel-dangerous-locations-gpkg",
  },
  {
    zip: "Helsinki Lighthouse-20260625T113858Z-3-001.zip",
    match: /Helsinki_eScooter_Observations\.zip$/i,
    dest: "Helsinki/Helsinki_eScooter_Observations.zip",
    label: "hel-escooter-nested-zip",
  },
  {
    zip: "Issy (Paris) Lighthouse-20260625T113904Z-3-001.zip",
    match: /ISSY1_baseline_traffic_data_november_2024\.csv$/i,
    dest: "Issy-20260427T130625Z-3-001/Issy/1. BASELINE DATA from Issy/ISSY1 - detailed traffic data/ISSY1_baseline_traffic_data_november_2024.csv",
    label: "issy-baseline-csv",
  },
  {
    zip: "Issy (Paris) Lighthouse-20260625T113904Z-3-001.zip",
    match: /ISSY1_post_intervention_traffic_data_november_2025\.csv$/i,
    dest: "Issy-20260427T130625Z-3-001/Issy/2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/ISSY1_post_intervention_traffic_data_november_2025.csv",
    label: "issy-post-csv",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /KPI1\.2-AYZG1-before\.xlsx$/i,
    dest: "Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG1-before.xlsx",
    label: "zar-kpi12-ayzg1-before",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /KPI1\.2-AYZG1-after\.xlsx$/i,
    dest: "Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG1-after.xlsx",
    label: "zar-kpi12-ayzg1-after",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /KPI1\.2-AYZG2-before\.xlsx$/i,
    dest: "Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG2-before.xlsx",
    label: "zar-kpi12-ayzg2-before",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /KPI1\.2-AYZG2-after\.xlsx$/i,
    dest: "Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG2-after.xlsx",
    label: "zar-kpi12-ayzg2-after",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /KPI1\.2-AYZG3-before\.xlsx$/i,
    dest: "Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG3-before.xlsx",
    label: "zar-kpi12-ayzg3-before",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /KPI1\.2-AYZG3-after\.xlsx$/i,
    dest: "Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG3-after.xlsx",
    label: "zar-kpi12-ayzg3-after",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /KPI1\.2-AYZG4-before\.xlsx$/i,
    dest: "Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG4-before.xlsx",
    label: "zar-kpi12-ayzg4-before",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /KPI1\.2-AYZG4-after\.xlsx$/i,
    dest: "Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG4-after.xlsx",
    label: "zar-kpi12-ayzg4-after",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /ManualCounting_June2025_AYZGZ1\.xlsx$/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/ManualCounting_June2025_AYZGZ1.xlsx",
    label: "zar-manual-counting",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /Intervention areas 1\.zip$/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/Intervention areas 1.zip",
    label: "zar-intervention-areas-zip",
  },
  {
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    match: /baseline data of the smart crossing on line survey_english\.xlsx$/i,
    dest: "Trikala/baseline data of the smart crossing on line survey_english.xlsx",
    label: "tri-smart-crossing-survey",
  },
  {
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    match: /ELABORATOR_ Women Mobility Questionnaire \(Responses\)\.xlsx$/i,
    dest: "Trikala/ELABORATOR_ Women Mobility Questionnaire (Responses).xlsx",
    label: "tri-women-mobility-survey",
  },
];

function listZipMembers(zipPath) {
  const output = execSync(`tar -tf "${zipPath}"`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return output.split(/\r?\n/).filter(Boolean);
}

async function extractMember(zipPath, memberPath, destPath) {
  const tempDir = path.join(OUT_DIR, ".extract-tmp", path.basename(zipPath, ".zip"));
  await fs.mkdir(tempDir, { recursive: true });
  const quotedMember = memberPath.includes(" ") ? `"${memberPath}"` : memberPath;
  execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quotedMember}`, {
    stdio: "pipe",
    maxBuffer: 50 * 1024 * 1024,
  });
  const extracted = path.join(tempDir, memberPath);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.copyFile(extracted, destPath);
}

async function unpackNestedZip(nestedZipPath, outSubdir) {
  const members = listZipMembers(nestedZipPath);
  const shpMembers = members.filter((m) => /\.(shp|dbf|shx|prj|cpg)$/i.test(m));
  if (shpMembers.length === 0) return [];
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "nested", path.basename(nestedZipPath, ".zip"));
  await fs.mkdir(tempDir, { recursive: true });
  for (const member of shpMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    execSync(`tar -xf "${nestedZipPath}" -C "${tempDir}" ${quoted}`, { stdio: "pipe" });
    const src = path.join(tempDir, member);
    const dest = path.join(OUT_DIR, outSubdir, path.basename(member));
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  return shpMembers.map((m) => path.join(outSubdir, path.basename(m)));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDrop: "public/Sharepoint_Datasets_06_2026",
    files: [],
    errors: [],
  };

  const zipCache = new Map();

  for (const item of EXTRACTIONS) {
    const zipPath = path.join(DROP_DIR, item.zip);
    try {
      await fs.access(zipPath);
    } catch {
      manifest.errors.push({ label: item.label, error: `Zip not found: ${item.zip}` });
      continue;
    }

    let members = zipCache.get(item.zip);
    if (!members) {
      members = listZipMembers(zipPath);
      zipCache.set(item.zip, members);
    }

    const member = members.find((m) => item.match.test(m));
    if (!member) {
      manifest.errors.push({ label: item.label, error: `No member matching ${item.match}` });
      continue;
    }

    const destPath = path.join(OUT_DIR, item.dest);
    try {
      await extractMember(zipPath, member, destPath);
      const stat = await fs.stat(destPath);
      manifest.files.push({
        label: item.label,
        sourceZip: item.zip,
        sourceMember: member,
        dest: item.dest,
        publicPath: `/sharepoint-data/${item.dest.replace(/\\/g, "/")}`,
        bytes: stat.size,
        status: "ok",
      });
      console.log(`OK  ${item.label} -> ${item.dest}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      manifest.errors.push({ label: item.label, error: message });
      console.error(`ERR ${item.label}: ${message}`);
    }
  }

  const zarAreasZip = path.join(OUT_DIR, "Zaragoza/1. BASELINE DATA from Zaragoza/Intervention areas 1.zip");
  try {
    await fs.access(zarAreasZip);
    const unpacked = await unpackNestedZip(
      zarAreasZip,
      "Zaragoza/1. BASELINE DATA from Zaragoza/Intervention areas 1"
    );
    manifest.files.push({
      label: "zar-intervention-areas-shapefile",
      dest: "Zaragoza/1. BASELINE DATA from Zaragoza/Intervention areas 1/*",
      publicPath: "/sharepoint-data/Zaragoza/1. BASELINE DATA from Zaragoza/Intervention areas 1/",
      bytes: unpacked.length,
      status: unpacked.length ? "ok" : "empty",
      members: unpacked,
    });
    console.log(`OK  zar-intervention-areas-shapefile (${unpacked.length} sidecar files)`);
  } catch (err) {
    manifest.errors.push({
      label: "zar-intervention-areas-shapefile",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\nManifest: ${MANIFEST_PATH}`);
  console.log(`Extracted: ${manifest.files.length} | Errors: ${manifest.errors.length}`);
  if (manifest.errors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
