#!/usr/bin/env node
/**
 * Build stable Trikala survey insight snapshot from SharePoint mirror workbooks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIRROR = path.join(ROOT, "public/sharepoint-data/Trikala");
const OUT = path.join(ROOT, "public/data/trikala/survey-insights.json");

const FILES = {
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
  const full = path.join(MIRROR, filename);
  if (!fs.existsSync(full)) return [];
  const wb = XLSX.readFile(full);
  const sheet = resolveSheet(wb);
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });
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

const women = loadRows(FILES.womenMobility);
const bike = loadRows(FILES.bikeLaneBaseline);

const snapshot = {
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

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${OUT} (women n=${women.length}, bike n=${bike.length})`);
