#!/usr/bin/env node
/**
 * Extract dashboard-critical files from Sharepoint_Datasets_06_2026 zips
 * into public/sharepoint-data/ (gitignored local mirror).
 */
import fs from "node:fs/promises";
import { readdirSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DROP_DIR = path.join(ROOT, "public", "Sharepoint_Datasets_06_2026");
const OUT_DIR = path.join(ROOT, "public", "sharepoint-data");
const MANIFEST_PATH = path.join(OUT_DIR, "_manifest.json");

const INCLUDE_ISSY_MEDIA = process.argv.includes("--include-issy-media");

const ISSY_ZIP = "Issy (Paris) Lighthouse-20260625T113904Z-3-001.zip";
const ISSY_DEST = "Issy-20260625T113904Z-3-001/Issy";
const ISSY_DEST_LEGACY = "Issy-20260427T130625Z-3-001/Issy";

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
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Countings_Hojbro\.xlsx$/i,
    dest: "Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Hojbro.xlsx",
    label: "cph-otc-hojbro",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Telraam counts Medieval City Copenhagen 2024 and 2025\.xlsx$/i,
    dest: "Copenhagen/Telraam/Telraam counts Medieval City Copenhagen 2024 and 2025.xlsx",
    label: "cph-telraam-summary",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Telraam\/Vestergade SHEET\.xlsx$/i,
    dest: "Copenhagen/Telraam/Vestergade SHEET.xlsx",
    label: "cph-telraam-vestergade",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Telraam\/Vognmagergade SHEET\.xlsx$/i,
    dest: "Copenhagen/Telraam/Vognmagergade SHEET.xlsx",
    label: "cph-telraam-vognmagergade",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Telraam\/Rosenborggade SHEET\.xlsx$/i,
    dest: "Copenhagen/Telraam/Rosenborggade SHEET.xlsx",
    label: "cph-telraam-rosenborggade",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Telraam\/Studiestr.*SHEET\.xlsx$/i,
    dest: "Copenhagen/Telraam/Studiestrade SHEET.xlsx",
    label: "cph-telraam-studiestraede",
    extractDir: "Copenhagen Lighthouse/1. BASELINE Data for Copenhagen/Telraam/",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /manual_counts_geo\.csv$/i,
    dest: "Copenhagen/manual_counts_geo.csv",
    label: "cph-manual-counts-geo",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Tube count bicyclist Medieval City April 2024\.xlsx$/i,
    dest: "Copenhagen/Tube Counts Bicyclist/Tube count bicyclist Medieval City April 2024.xlsx",
    label: "cph-tube-counts",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /I100275_P-pladser_Oversigt\.xlsx$/i,
    dest: "Copenhagen/Technical drawing - Medieval City/I100275_P-pladser_Oversigt.xlsx",
    label: "cph-parking-overview",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Acceptability_Intervention1_BEFORE\.xlsx$/i,
    dest: "Copenhagen/Surveys/Acceptability_Intervention1_BEFORE.xlsx",
    label: "cph-survey-acceptability-before",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Acceptability_Intervention1_AFTER\.xlsx$/i,
    dest: "Copenhagen/Surveys/Acceptability_Intervention1_AFTER.xlsx",
    label: "cph-survey-acceptability-after",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Before_After_changes_traffic_safety\.xlsx$/i,
    dest: "Copenhagen/Surveys/Before_After_changes_traffic_safety.xlsx",
    label: "cph-survey-safety-perception",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /iRap safety ranking Counts in 2024 and 2025 CPH\.xlsx$/i,
    dest: "Copenhagen/iRAP/iRap safety ranking Counts in 2024 and 2025 CPH.xlsx",
    label: "cph-irap-counts",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Medieval City manual counts traffic_2023_uploaded to ELABORATOR\.xlsx$/i,
    dest: "Copenhagen/Manual Counts/Medieval City manual counts traffic_2023_uploaded to ELABORATOR.xlsx",
    label: "cph-manual-zones-2023",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /Middelalderbyen_trafik_ind_2023_rettet_20250402\.xlsx$/i,
    dest: "Copenhagen/Manual Counts/Middelalderbyen_trafik_ind_2023_rettet_20250402.xlsx",
    label: "cph-manual-zones-detail",
  },
  {
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    match: /platomo_geo\.csv$/i,
    dest: "Copenhagen/platomo_geo.csv",
    label: "cph-platomo-geo",
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
    match: /Helsinki_Intervention_Locations_EPSG3067\.gpkg$/i,
    dest: "Helsinki/Helsinki_Intervention_Locations_EPSG3067.gpkg",
    label: "hel-intervention-locations-gpkg",
  },
  {
    zip: "Helsinki Lighthouse-20260625T113858Z-3-001.zip",
    match: /Helsinki_eScooter_Observations\.zip$/i,
    dest: "Helsinki/Helsinki_eScooter_Observations.zip",
    label: "hel-escooter-nested-zip",
  },
  {
    zip: ISSY_ZIP,
    match: /ISSY1_baseline_traffic_data_november_2024\.csv$/i,
    dest: `${ISSY_DEST}/1. BASELINE DATA from Issy/ISSY1 - detailed traffic data/ISSY1_baseline_traffic_data_november_2024.csv`,
    label: "issy-baseline-csv",
  },
  {
    zip: ISSY_ZIP,
    match: /ISSY1_post_intervention_traffic_data_november_2025\.csv$/i,
    dest: `${ISSY_DEST}/2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/ISSY1_post_intervention_traffic_data_november_2025.csv`,
    label: "issy-post-csv",
  },
  {
    zip: ISSY_ZIP,
    match: /ISSY1_baseline_traffic_data_november_2024\.csv$/i,
    dest: `${ISSY_DEST_LEGACY}/1. BASELINE DATA from Issy/ISSY1 - detailed traffic data/ISSY1_baseline_traffic_data_november_2024.csv`,
    label: "issy-baseline-csv-legacy",
  },
  {
    zip: ISSY_ZIP,
    match: /ISSY1_post_intervention_traffic_data_november_2025\.csv$/i,
    dest: `${ISSY_DEST_LEGACY}/2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/ISSY1_post_intervention_traffic_data_november_2025.csv`,
    label: "issy-post-csv-legacy",
  },
  {
    zip: ISSY_ZIP,
    match: /baseline_evaluation_data_light_emitting_marking_solution\.xlsx$/i,
    dest: `${ISSY_DEST}/1. BASELINE DATA from Issy/baseline_evaluation_data_light_emitting_marking_solution.xlsx`,
    label: "issy-wintics-baseline-xlsx",
  },
  {
    zip: ISSY_ZIP,
    match: /Classeur\.xlsx$/i,
    dest: `${ISSY_DEST}/1. BASELINE DATA from Issy/Classeur.xlsx`,
    label: "issy-classeur-emissions-xlsx",
  },
  {
    zip: ISSY_ZIP,
    match: /Pre-intervention evaluation - data requirements\.xlsx$/i,
    dest: `${ISSY_DEST}/Pre-intervention evaluation - data requirements.xlsx`,
    label: "issy-data-requirements-xlsx",
  },
  {
    zip: ISSY_ZIP,
    match: /ELABORATOR_Issy-Le-Molineaux_Metadata_Records\.xlsx$/i,
    dest: `${ISSY_DEST}/ELABORATOR_Issy-Le-Molineaux_Metadata_Records.xlsx`,
    label: "issy-metadata-records-xlsx",
  },
  {
    zip: ISSY_ZIP,
    match: /ISSY Intervention Evaluation Plan_DRAFT \(1\)\.docx$/i,
    dest: `${ISSY_DEST}/ISSY Intervention Evaluation Plan_DRAFT (1).docx`,
    label: "issy-evaluation-plan-docx",
  },
  {
    zip: ISSY_ZIP,
    match: /FLOWELL ISSY - T0-T1 SYNTHESIS \.pdf$/i,
    dest: `${ISSY_DEST}/1. BASELINE DATA from Issy/FLOWELL ISSY - T0-T1 SYNTHESIS .pdf`,
    label: "issy-flowell-synthesis-pdf",
  },
  {
    zip: ISSY_ZIP,
    match: /1\. BASELINE DATA from Issy\/ISSY1 - detailed traffic data\/readme\.docx$/i,
    dest: `${ISSY_DEST}/1. BASELINE DATA from Issy/ISSY1 - detailed traffic data/readme.docx`,
    label: "issy-baseline-readme-docx",
  },
  {
    zip: ISSY_ZIP,
    match: /2\. POST IMPLEMENTATION DATA from Issy\/ISSY1 - detailed traffic_data\/readme\.docx$/i,
    dest: `${ISSY_DEST}/2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/readme.docx`,
    label: "issy-post-readme-docx",
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
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /AirQuality\.xlsx$/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/AirQuality.xlsx",
    label: "zar-air-quality-xlsx",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /RoadSafetyCitizenSurvey_BaselinePerceptionAssessment\.xlsx$/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/RoadSafetyCitizenSurvey_BaselinePerceptionAssessment.xlsx",
    label: "zar-road-safety-survey",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /Barriers and Ctizen Expectations\.xlsx$/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/ELABORATOR_Survey on the identification of Barriers and Ctizen Expectations.xlsx",
    label: "zar-barriers-survey",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /Comparativa KPIs baselime\.xlsx$/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/Comparativa KPIs baselime.xlsx",
    label: "zar-comparativa-kpis",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /ZaragozaOneToOne_March2026\.xlsx$/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/ZaragozaOneToOne_March2026.xlsx",
    label: "zar-one-to-one-march2026",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /Monitoring traffic school M Salas/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/Monitoring traffic school M Salas 1-10-2025.xlsx",
    label: "zar-school-msalas",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /Monitoring traffic school Az/i,
    dest: "Zaragoza/1. BASELINE DATA from Zaragoza/Monitoring traffic school Azua 16-10-2025.xlsx",
    label: "zar-school-azua",
  },
  {
    zip: "Zaragoza Lighthouse-20260625T113918Z-3-001.zip",
    match: /Zaragoza Intervention Evaluation Plan_3052025\.docx$/i,
    dest: "Zaragoza/Zaragoza Intervention Evaluation Plan_3052025.docx",
    label: "zar-evaluation-plan",
  },
  {
    zip: "Milano-20260709T084301Z-2-001.zip",
    match: /Milan_Accessibility_Features_DSS_Analysis_CIRCE\.xlsx$/i,
    dest: "Milan/Eval data Ex ante/8. Data - accessibility features/Milan_Accessibility_Features_DSS_Analysis_CIRCE.xlsx",
    label: "mil-accessibility-dss-xlsx",
  },
  {
    zip: "Milano-20260709T084301Z-2-001.zip",
    match: /1\. Shape file\/Pilot 1_AMAT\/pilot01\.shp$/i,
    dest: "Milan/1. Shape file/Pilot 1_AMAT/pilot01.shp",
    label: "mil-pilot01-shp",
  },
  {
    zip: "Milano-20260709T084301Z-2-001.zip",
    match: /1\. Shape file\/Pilot 2_AMAT\/pilot02\.shp$/i,
    dest: "Milan/1. Shape file/Pilot 2_AMAT/pilot02.shp",
    label: "mil-pilot02-shp",
  },
  {
    zip: "Milano-20260709T084301Z-2-001.zip",
    match: /DSS pedestrian tool graph\/walk_graph\.shp$/i,
    dest: "Milan/DSS pedestrian tool graph/walk_graph.shp",
    label: "mil-walk-graph-shp",
  },
  {
    zip: "Milano-20260709T084301Z-2-001.zip",
    match: /Eval data Ex ante\/6\. CO2 and noise emissions\/.*\.shp$/i,
    dest: "Milan/Eval data Ex ante/6. CO2 and noise emissions/network_co2_noise.shp",
    label: "mil-co2-network-shp",
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
  {
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    match: /baseline data on bike safety from the on line syrvey_english\.xlsx$/i,
    dest: "Trikala/baseline data on bike safety from the on line syrvey_english.xlsx",
    label: "tri-bike-lane-baseline",
  },
  {
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    match: /Post Intervention _ELABORATOR_ Smart crossing_raw data eng\.xlsx$/i,
    dest: "Trikala/post/Post Intervention _ELABORATOR_ Smart crossing_raw data eng.xlsx",
    label: "tri-smart-crossing-post",
  },
  {
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    match: /Post Intervention_ELABORATOR_Cycling Safety_Raw dataEnglish_headers\.xlsx$/i,
    dest: "Trikala/post/Post Intervention_ELABORATOR_Cycling Safety_Raw dataEnglish_headers.xlsx",
    label: "tri-bike-lane-post",
  },
  {
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    match: /Survey of SMARTA app_row data\.xlsx$/i,
    dest: "Trikala/post/Survey of SMARTA app_row data.xlsx",
    label: "tri-smarta-app-post",
  },
  {
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    match: /smart_citizen_kit_environmental_metrics\.xlsx$/i,
    dest: "Trikala/smart_citizen_kit_environmental_metrics.xlsx",
    label: "tri-environmental-sensors",
  },
  {
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    match: /Meeting attendance_ETrikala_230525\.xlsx$/i,
    dest: "Trikala/Meeting attendance_ETrikala_230525.xlsx",
    label: "tri-meeting-attendance",
  },
];

function listZipMembers(zipPath) {
  const output = execSync(`tar -tf "${zipPath}"`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return output.split(/\r?\n/).filter(Boolean);
}

function findFileMatching(dir, predicate) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (predicate(entry.name, full)) return full;
    }
  }
  return null;
}

function findFileBySuffix(dir, suffix) {
  return findFileMatching(dir, (name) => name.toLowerCase().endsWith(suffix.toLowerCase()));
}

async function extractMember(zipPath, memberPath, destPath, options = {}) {
  const tempDir = path.join(OUT_DIR, ".extract-tmp", path.basename(zipPath, ".zip"));
  await fs.mkdir(tempDir, { recursive: true });
  if (options.extractDir) {
    const quotedDir = options.extractDir.includes(" ") ? `"${options.extractDir}"` : options.extractDir;
    execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quotedDir}`, {
      stdio: "pipe",
      maxBuffer: 50 * 1024 * 1024,
    });
  } else {
    const quotedMember = memberPath.includes(" ") ? `"${memberPath}"` : memberPath;
    execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quotedMember}`, {
      stdio: "pipe",
      maxBuffer: 50 * 1024 * 1024,
    });
  }
  let extracted = null;
  if (options.extractDir) {
    extracted = findFileMatching(
      tempDir,
      (name) => /SHEET\.xlsx$/i.test(name) && /studiestr/i.test(name)
    );
    if (!extracted) throw new Error(`Extracted member missing under: ${options.extractDir}`);
  } else {
    extracted = path.join(tempDir, memberPath);
    try {
      await fs.access(extracted);
    } catch {
      let fallback = findFileBySuffix(tempDir, path.basename(destPath));
      if (!fallback) {
        fallback = findFileMatching(
          tempDir,
          (name) => /SHEET\.xlsx$/i.test(name) && /studiestr/i.test(name)
        );
      }
      if (!fallback) throw new Error(`Extracted member missing: ${memberPath}`);
      extracted = fallback;
    }
  }
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

async function unpackShapefileFromZip(zipPath, memberPattern, outSubdir) {
  const members = listZipMembers(zipPath);
  const shpMember = members.find((m) => memberPattern.test(m) && /\.shp$/i.test(m));
  if (!shpMember) return [];
  const normShp = shpMember.replace(/\\/g, "/");
  const dir = normShp.slice(0, normShp.lastIndexOf("/"));
  const baseName = path.basename(normShp, ".shp");
  const sidecars = members.filter((m) => {
    const norm = m.replace(/\\/g, "/");
    if (!norm.startsWith(`${dir}/`)) return false;
    const bn = path.basename(norm);
    return bn.toLowerCase().startsWith(baseName.toLowerCase());
  });
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "shp", path.basename(zipPath, ".zip"));
  await fs.mkdir(tempDir, { recursive: true });
  for (const member of sidecars) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
  }
  const written = [];
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(shp|dbf|shx|prj|cpg|qmd)$/i.test(entry.name)) {
        const dest = path.join(OUT_DIR, outSubdir, entry.name);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(path.join(outSubdir, entry.name));
      }
    }
  };
  await walk(tempDir);
  return written;
}

async function unpackManualCounts2025(zipPath) {
  const members = listZipMembers(zipPath);
  const files = members.filter(
    (m) =>
      /Manual Counts 2025 Medieval City\//i.test(m) &&
      /\.xlsx$/i.test(m) &&
      !m.includes("__MACOSX")
  );
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "manual-2025");
  await fs.mkdir(tempDir, { recursive: true });
  const written = [];
  for (const member of files) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
  }
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.xlsx$/i.test(entry.name)) {
        const dest = path.join(OUT_DIR, "Copenhagen/Manual Counts/2025", entry.name);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(`Copenhagen/Manual Counts/2025/${entry.name}`);
      }
    }
  };
  await walk(tempDir);
  return written;
}

async function unpackMediaFromZip(zipPath) {
  const members = listZipMembers(zipPath);
  const mediaMembers = members.filter(
    (m) =>
      (/2024 Images-Monica\//i.test(m) || /iRap safety ranking system\//i.test(m)) &&
      /\.(jpg|jpeg|png)$/i.test(m) &&
      !m.includes("__MACOSX")
  );
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "cph-media");
  await fs.mkdir(tempDir, { recursive: true });
  const written = [];
  for (const member of mediaMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    try {
      execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
    } catch {
      continue;
    }
  }
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(jpg|jpeg|png)$/i.test(entry.name)) {
        const safeName = entry.name.replace(/[^a-zA-Z0-9._-]+/g, "_").toLowerCase();
        const dest = path.join(OUT_DIR, "Copenhagen/media", safeName);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(`Copenhagen/media/${safeName}`);
      }
    }
  };
  await walk(tempDir);
  return written;
}

function trikalaSafeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

async function unpackTrikalaMedia(zipPath) {
  const members = listZipMembers(zipPath);
  const mediaMembers = members.filter(
    (m) => /\.(jpg|jpeg|png)$/i.test(m) && !m.includes("__MACOSX") && !m.endsWith("/")
  );
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "tri-media");
  await fs.mkdir(tempDir, { recursive: true });
  const written = [];
  for (const member of mediaMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    try {
      execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
    } catch {
      continue;
    }
  }
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(jpg|jpeg|png)$/i.test(entry.name)) {
        const safeName = trikalaSafeFileName(entry.name);
        const dest = path.join(OUT_DIR, "Trikala/media", safeName);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(`Trikala/media/${safeName}`);
      }
    }
  };
  await walk(tempDir);
  return written;
}

async function unpackTrikalaBikeLaneSensors(zipPath) {
  const members = listZipMembers(zipPath);
  const sensorMembers = members.filter(
    (m) =>
      /BIKE LANE SENSORS DATA\//i.test(m) &&
      /\.xlsx$/i.test(m) &&
      !m.includes("__MACOSX") &&
      !m.endsWith("/")
  );
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "tri-bike-lane-sensors");
  await fs.mkdir(tempDir, { recursive: true });
  const written = [];
  for (const member of sensorMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    try {
      execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, {
        stdio: "pipe",
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch {
      continue;
    }
  }
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.xlsx$/i.test(entry.name)) {
        const dest = path.join(OUT_DIR, "Trikala/bike-lane-sensors", entry.name);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(`Trikala/bike-lane-sensors/${entry.name}`);
      }
    }
  };
  await walk(tempDir);
  return written;
}

async function unpackTrikalaDocs(zipPath) {
  const members = listZipMembers(zipPath);
  const docMembers = members.filter(
    (m) => /\.(pdf|docx|pptx)$/i.test(m) && !m.includes("__MACOSX") && !m.endsWith("/")
  );
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "tri-docs");
  await fs.mkdir(tempDir, { recursive: true });
  const written = [];
  for (const member of docMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    try {
      execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
    } catch {
      continue;
    }
  }
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(pdf|docx|pptx)$/i.test(entry.name)) {
        const safeName = trikalaSafeFileName(entry.name);
        const dest = path.join(OUT_DIR, "Trikala/docs", safeName);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(`Trikala/docs/${safeName}`);
      }
    }
  };
  await walk(tempDir);
  return written;
}

function issySafeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

async function unpackIssyEngagements(zipPath) {
  const members = listZipMembers(zipPath);
  const engagementMembers = members.filter(
    (m) =>
      /3\. City engagements & Meetings\//i.test(m) &&
      /\.(xlsx|docx)$/i.test(m) &&
      !m.includes("__MACOSX") &&
      !m.endsWith("/")
  );
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "issy-engagements");
  await fs.mkdir(tempDir, { recursive: true });
  const written = [];
  for (const member of engagementMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    try {
      execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, {
        stdio: "pipe",
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch {
      continue;
    }
  }
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(xlsx|docx)$/i.test(entry.name)) {
        const normalized = full.replace(/\\/g, "/");
        const marker = "3. City engagements & Meetings/";
        const idx = normalized.toLowerCase().indexOf(marker.toLowerCase());
        if (idx < 0) continue;
        const relFromEng = normalized.slice(idx + marker.length);
        const dest = path.join(OUT_DIR, ISSY_DEST, "3. City engagements & Meetings", relFromEng);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(`${ISSY_DEST}/3. City engagements & Meetings/${relFromEng}`);
      }
    }
  };
  await walk(tempDir);
  return written;
}

async function unpackIssyMedia(zipPath, includeLargeVideo) {
  const members = listZipMembers(zipPath);
  const mediaMembers = members.filter((m) => {
    if (m.includes("__MACOSX") || m.endsWith("/")) return false;
    if (/Video n image from Monica_2024\/Image\.jpg$/i.test(m)) return true;
    if (!includeLargeVideo) return false;
    return /\.(jpg|jpeg|png|mov|mp4)$/i.test(m) && /Issy \(Paris\) Lighthouse\//i.test(m);
  });
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "issy-media");
  await fs.mkdir(tempDir, { recursive: true });
  const written = [];
  for (const member of mediaMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    try {
      execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, {
        stdio: "pipe",
        maxBuffer: 200 * 1024 * 1024,
      });
    } catch {
      continue;
    }
  }
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(jpg|jpeg|png|mov|mp4)$/i.test(entry.name)) {
        const safeName = issySafeFileName(entry.name);
        const dest = path.join(OUT_DIR, ISSY_DEST, "media", safeName);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(`${ISSY_DEST}/media/${safeName}`);
      }
    }
  };
  await walk(tempDir);
  return written;
}

async function unpackCopenhagenDocs(zipPath) {
  const members = listZipMembers(zipPath);
  const docMembers = members.filter(
    (m) =>
      (/Evaluering af oml/i.test(m) || /Copenhagen Intervention Evaluation Plan/i.test(m)) &&
      /\.(pdf|docx)$/i.test(m) &&
      !m.includes("__MACOSX")
  );
  const tempDir = path.join(OUT_DIR, ".extract-tmp", "cph-docs");
  await fs.mkdir(tempDir, { recursive: true });
  const written = [];
  for (const member of docMembers) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    try {
      execSync(`tar -xf "${zipPath}" -C "${tempDir}" ${quoted}`, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
    } catch {
      continue;
    }
  }
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(pdf|docx)$/i.test(entry.name)) {
        const safeName = entry.name.replace(/[^a-zA-Z0-9._-]+/g, "_").toLowerCase();
        const dest = path.join(OUT_DIR, "Copenhagen/docs", safeName);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(full, dest);
        written.push(`Copenhagen/docs/${safeName}`);
      }
    }
  };
  await walk(tempDir);
  return written;
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
      await extractMember(zipPath, member, destPath, item.extractDir ? { extractDir: item.extractDir } : {});
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

  const triZip = path.join(DROP_DIR, "Trikala Lighthouse-20260625T113913Z-3-001.zip");
  try {
    await fs.access(triZip);
    try {
      const triMedia = await unpackTrikalaMedia(triZip);
      manifest.files.push({
        label: "tri-media-gallery",
        dest: "Trikala/media/*",
        publicPath: "/sharepoint-data/Trikala/media/",
        bytes: triMedia.length,
        status: triMedia.length ? "ok" : "empty",
        members: triMedia.slice(0, 8),
        memberCount: triMedia.length,
      });
      console.log(`OK  tri-media-gallery (${triMedia.length} images)`);
    } catch (err) {
      manifest.errors.push({
        label: "tri-media-gallery",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const triDocs = await unpackTrikalaDocs(triZip);
      manifest.files.push({
        label: "tri-docs-bundle",
        dest: "Trikala/docs/*",
        publicPath: "/sharepoint-data/Trikala/docs/",
        bytes: triDocs.length,
        status: triDocs.length ? "ok" : "empty",
        members: triDocs.slice(0, 8),
        memberCount: triDocs.length,
      });
      console.log(`OK  tri-docs-bundle (${triDocs.length} documents)`);
    } catch (err) {
      manifest.errors.push({
        label: "tri-docs-bundle",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    manifest.errors.push({
      label: "tri-bulk-extract",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const triBikeLaneZip = path.join(DROP_DIR, "BIKE LANE SENSORS DATA-20260713T091909Z-2-001.zip");
  try {
    await fs.access(triBikeLaneZip);
    const bikeLaneSensors = await unpackTrikalaBikeLaneSensors(triBikeLaneZip);
    manifest.files.push({
      label: "tri-bike-lane-sensor-timeseries",
      dest: "Trikala/bike-lane-sensors/*",
      publicPath: "/sharepoint-data/Trikala/bike-lane-sensors/",
      bytes: bikeLaneSensors.length,
      status: bikeLaneSensors.length ? "ok" : "empty",
      members: bikeLaneSensors.slice(0, 8),
      memberCount: bikeLaneSensors.length,
    });
    console.log(`OK  tri-bike-lane-sensor-timeseries (${bikeLaneSensors.length} workbooks)`);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      manifest.errors.push({
        label: "tri-bike-lane-sensor-timeseries",
        error: "BIKE LANE SENSORS zip not found in Sharepoint_Datasets_06_2026",
      });
    } else {
      manifest.errors.push({
        label: "tri-bike-lane-sensor-timeseries",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const cphZip = path.join(DROP_DIR, "Copenhagen Lighthouse-20260625T113853Z-3-001.zip");
  try {
    await fs.access(cphZip);
    try {
      const parkingShp = await unpackShapefileFromZip(
        cphZip,
        /P-pladser_.*\.shp$/i,
        "Copenhagen/Technical drawing - Medieval City/parking-shp"
      );
      manifest.files.push({
        label: "cph-parking-shapefile",
        dest: "Copenhagen/Technical drawing - Medieval City/parking-shp/*",
        publicPath: "/sharepoint-data/Copenhagen/Technical drawing - Medieval City/parking-shp/",
        bytes: parkingShp.length,
        status: parkingShp.length ? "ok" : "empty",
        members: parkingShp,
      });
      console.log(`OK  cph-parking-shapefile (${parkingShp.length} sidecar files)`);
    } catch (err) {
      manifest.errors.push({
        label: "cph-parking-shapefile",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const manual2025 = await unpackManualCounts2025(cphZip);
      manifest.files.push({
        label: "cph-manual-counts-2025-bulk",
        dest: "Copenhagen/Manual Counts/2025/*",
        publicPath: "/sharepoint-data/Copenhagen/Manual Counts/2025/",
        bytes: manual2025.length,
        status: manual2025.length ? "ok" : "empty",
        members: manual2025.slice(0, 5),
        memberCount: manual2025.length,
      });
      console.log(`OK  cph-manual-counts-2025-bulk (${manual2025.length} workbooks)`);
    } catch (err) {
      manifest.errors.push({
        label: "cph-manual-counts-2025-bulk",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const media = await unpackMediaFromZip(cphZip);
      manifest.files.push({
        label: "cph-media-gallery",
        dest: "Copenhagen/media/*",
        publicPath: "/sharepoint-data/Copenhagen/media/",
        bytes: media.length,
        status: media.length ? "ok" : "empty",
        members: media.slice(0, 8),
        memberCount: media.length,
      });
      console.log(`OK  cph-media-gallery (${media.length} images)`);
    } catch (err) {
      manifest.errors.push({
        label: "cph-media-gallery",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const docs = await unpackCopenhagenDocs(cphZip);
      manifest.files.push({
        label: "cph-partner-docs",
        dest: "Copenhagen/docs/*",
        publicPath: "/sharepoint-data/Copenhagen/docs/",
        bytes: docs.length,
        status: docs.length ? "ok" : "empty",
        members: docs,
      });
      console.log(`OK  cph-partner-docs (${docs.length} files)`);
    } catch (err) {
      manifest.errors.push({
        label: "cph-partner-docs",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    manifest.errors.push({
      label: "cph-bulk-extract",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const milZip = path.join(DROP_DIR, "Milano-20260709T084301Z-2-001.zip");
  try {
    await fs.access(milZip);
    const milShapefiles = [
      {
        label: "mil-pilot01-shapefile",
        pattern: /1\. Shape file\/Pilot 1_AMAT\/pilot01\.shp$/i,
        outSubdir: "Milan/1. Shape file/Pilot 1_AMAT",
      },
      {
        label: "mil-pilot02-shapefile",
        pattern: /1\. Shape file\/Pilot 2_AMAT\/pilot02\.shp$/i,
        outSubdir: "Milan/1. Shape file/Pilot 2_AMAT",
      },
      {
        label: "mil-walk-graph-shapefile",
        pattern: /DSS pedestrian tool graph\/walk_graph\.shp$/i,
        outSubdir: "Milan/DSS pedestrian tool graph",
      },
      {
        label: "mil-co2-network-shapefile",
        pattern: /Eval data Ex ante\/6\. CO2 and noise emissions\/.*\.shp$/i,
        outSubdir: "Milan/Eval data Ex ante/6. CO2 and noise emissions",
      },
    ];
    for (const shapefile of milShapefiles) {
      try {
        const extracted = await unpackShapefileFromZip(milZip, shapefile.pattern, shapefile.outSubdir);
        manifest.files.push({
          label: shapefile.label,
          dest: `${shapefile.outSubdir}/*`,
          publicPath: `/sharepoint-data/${shapefile.outSubdir}/`,
          bytes: extracted.length,
          status: extracted.length ? "ok" : "empty",
          members: extracted,
        });
        console.log(`OK  ${shapefile.label} (${extracted.length} sidecar files)`);
      } catch (err) {
        manifest.errors.push({
          label: shapefile.label,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    manifest.errors.push({
      label: "mil-bulk-extract",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const issyZip = path.join(DROP_DIR, ISSY_ZIP);
  try {
    await fs.access(issyZip);
    try {
      const issyEngagements = await unpackIssyEngagements(issyZip);
      manifest.files.push({
        label: "issy-engagements-bundle",
        dest: `${ISSY_DEST}/3. City engagements & Meetings/*`,
        publicPath: `/sharepoint-data/${ISSY_DEST}/3. City engagements & Meetings/`,
        bytes: issyEngagements.length,
        status: issyEngagements.length ? "ok" : "empty",
        members: issyEngagements,
        memberCount: issyEngagements.length,
      });
      console.log(`OK  issy-engagements-bundle (${issyEngagements.length} files)`);
    } catch (err) {
      manifest.errors.push({
        label: "issy-engagements-bundle",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const issyMedia = await unpackIssyMedia(issyZip, INCLUDE_ISSY_MEDIA);
      manifest.files.push({
        label: INCLUDE_ISSY_MEDIA ? "issy-media-gallery-full" : "issy-media-gallery",
        dest: `${ISSY_DEST}/media/*`,
        publicPath: `/sharepoint-data/${ISSY_DEST}/media/`,
        bytes: issyMedia.length,
        status: issyMedia.length ? "ok" : "empty",
        members: issyMedia,
        memberCount: issyMedia.length,
        notes: INCLUDE_ISSY_MEDIA
          ? "Full video mirror (~630 MB)"
          : "Site photo only; pass --include-issy-media for mp4/mov",
      });
      console.log(
        `OK  ${INCLUDE_ISSY_MEDIA ? "issy-media-gallery-full" : "issy-media-gallery"} (${issyMedia.length} files)`
      );
    } catch (err) {
      manifest.errors.push({
        label: "issy-media-gallery",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    manifest.errors.push({
      label: "issy-bulk-extract",
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
