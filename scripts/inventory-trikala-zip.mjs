#!/usr/bin/env node
/**
 * Inventory Trikala Lighthouse zip: folder tree summary + Excel sheet names + row counts.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIP = path.join(
  ROOT,
  "public/Sharepoint_Datasets_06_2026/Trikala Lighthouse-20260625T113913Z-3-001.zip"
);
const TMP = path.join(ROOT, "public/sharepoint-data/.inventory-tmp/trikala");
const OUT = path.join(ROOT, "docs/TRIKALA_ZIP_INVENTORY.json");

const KEY_XLSX_PATTERNS = [
  /Women Mobility Questionnaire/i,
  /smart crossing on line survey/i,
  /bike safety from the on line syrvey/i,
  /Smart crossing_raw data/i,
  /Cycling Safety_Raw data/i,
  /SMARTA app_row data/i,
  /smart_citizen_kit/i,
  /Meeting attendance/i,
];

function listZipMembers() {
  const output = execSync(`tar -tf "${ZIP}"`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return output.split(/\r?\n/).filter(Boolean);
}

function folderSummary(members) {
  const top = new Map();
  for (const m of members) {
    const parts = m.replace(/^Trikala Lighthouse\//, "").split("/");
    const key = parts.slice(0, 2).join("/") || parts[0] || m;
    top.set(key, (top.get(key) || 0) + 1);
  }
  return [...top.entries()].sort((a, b) => b[1] - a[1]);
}

function extractMember(member) {
  fs.mkdirSync(TMP, { recursive: true });
  const quoted = member.includes(" ") ? `"${member}"` : member;
  execSync(`tar -xf "${ZIP}" -C "${TMP}" ${quoted}`, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
  return path.join(TMP, member);
}

function inspectXlsx(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheets = {};
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, raw: false });
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    sheets[name] = {
      rowCount: rows.length,
      headers: headers.slice(0, 20),
      headerCount: headers.length,
    };
  }
  return { sheetNames: wb.SheetNames, sheets };
}

function main() {
  const members = listZipMembers();
  const xlsxMembers = members.filter((m) => /\.xlsx$/i.test(m));
  const keyMembers = xlsxMembers.filter((m) => KEY_XLSX_PATTERNS.some((re) => re.test(m)));

  const inspected = [];
  for (const member of keyMembers) {
    try {
      const local = extractMember(member);
      const shortName = member.replace(/^Trikala Lighthouse\//, "");
      inspected.push({ path: shortName, type: "xlsx", ...inspectXlsx(local) });
    } catch (err) {
      inspected.push({
        path: member.replace(/^Trikala Lighthouse\//, ""),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    zip: "Trikala Lighthouse-20260625T113913Z-3-001.zip",
    totals: {
      allFiles: members.length,
      xlsx: xlsxMembers.length,
      images: members.filter((m) => /\.(png|jpg|jpeg|gif)$/i.test(m)).length,
      pdfs: members.filter((m) => /\.pdf$/i.test(m)).length,
    },
    folderSummary: folderSummary(members).map(([folder, count]) => ({ folder, count })),
    keyFilesInspected: inspected,
    allXlsxPaths: xlsxMembers.map((m) => m.replace(/^Trikala Lighthouse\//, "")),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(`Files: ${report.totals.allFiles} | xlsx: ${report.totals.xlsx} | inspected: ${inspected.length}`);
}

main();
