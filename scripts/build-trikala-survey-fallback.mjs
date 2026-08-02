#!/usr/bin/env node
/**
 * Bundle Trikala survey workbook rows for production.
 * SharePoint XLSX under public/sharepoint-data/Trikala is gitignored; without
 * this fallback, Pilot 4 mode share + SMARTA satisfaction (and Pilot 1 surveys)
 * render empty on Vercel.
 *
 * Output: public/data/trikala/survey-rows-fallback.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIRROR = path.join(ROOT, "public/sharepoint-data/Trikala");
const OUT = path.join(ROOT, "public/data/trikala/survey-rows-fallback.json");

const FILES = {
  smartCrossingBaseline: "baseline data of the smart crossing on line survey_english.xlsx",
  womenMobility: "ELABORATOR_ Women Mobility Questionnaire (Responses).xlsx",
  bikeLaneBaseline: "baseline data on bike safety from the on line syrvey_english.xlsx",
  smartCrossingPost: path.join("post", "Post Intervention _ELABORATOR_ Smart crossing_raw data eng.xlsx"),
  bikeLanePost: path.join(
    "post",
    "Post Intervention_ELABORATOR_Cycling Safety_Raw dataEnglish_headers.xlsx"
  ),
  smartaAppPost: path.join("post", "Survey of SMARTA app_row data.xlsx"),
};

function resolveSheet(workbook) {
  const preferred = workbook.SheetNames.find((n) =>
    /form responses|απαντήσεις φόρμας|sheet1/i.test(n)
  );
  return preferred ?? workbook.SheetNames[0];
}

function loadRows(relativePath) {
  const full = path.join(MIRROR, relativePath);
  if (!fs.existsSync(full)) {
    console.warn(`Missing ${relativePath}`);
    return [];
  }
  const wb = XLSX.readFile(full);
  const sheet = resolveSheet(wb);
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });
}

const bundle = {
  generatedAt: new Date().toISOString(),
  source: "Trikala SharePoint mirror survey workbooks → deploy fallback",
  sheets: {},
};

for (const [key, relativePath] of Object.entries(FILES)) {
  const rows = loadRows(relativePath);
  bundle.sheets[key] = rows;
  console.log(`${key}: ${rows.length} rows`);
}

const total = Object.values(bundle.sheets).reduce((n, rows) => n + rows.length, 0);
if (total === 0) {
  console.error("No survey rows found — keep existing fallback if present.");
  if (fs.existsSync(OUT)) {
    console.error(`Leaving ${OUT} unchanged.`);
    process.exit(0);
  }
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(bundle));
const sizeMb = (fs.statSync(OUT).size / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${OUT} (${sizeMb} MB, ${total} total rows)`);
