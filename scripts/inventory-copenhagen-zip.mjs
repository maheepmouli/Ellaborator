#!/usr/bin/env node
/**
 * Inventory Copenhagen Lighthouse zip: folder tree summary + Excel sheet names + OTC flows.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIP = path.join(
  ROOT,
  "public/Sharepoint_Datasets_06_2026/Copenhagen Lighthouse-20260625T113853Z-3-001.zip"
);
const TMP = path.join(ROOT, "public/sharepoint-data/.inventory-tmp");
const OUT = path.join(ROOT, "docs/COPENHAGEN_ZIP_INVENTORY.json");

const KEY_XLSX_PATTERNS = [
  /Countings_.*_sortet\.xlsx$/i,
  /Countings_(Norreport|Vandkunsten|Gammeltorv|Stormgade|Hojbro)\.xlsx$/i,
  /cph_otc_surveysites\.xlsx$/i,
  /Telraam counts Medieval City/i,
  /Telraam\/.*SHEET\.xlsx$/i,
  /Acceptability_Intervention1/i,
  /Before_After_changes_traffic_safety/i,
  /iRap safety ranking Counts/i,
  /Medieval City manual counts traffic_2023/i,
  /Middelalderbyen_trafik_ind_2023/i,
  /Tube count bicyclist/i,
  /I100275_P-pladser_Oversigt/i,
  /OTC Combined counts ELABORATOR/i,
  /manual_counts_geo\.csv$/i,
  /platomo_geo\.csv$/i,
];

function listZipMembers() {
  const output = execSync(`tar -tf "${ZIP}"`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return output.split(/\r?\n/).filter(Boolean);
}

function folderSummary(members) {
  const top = new Map();
  for (const m of members) {
    const parts = m.replace(/^Copenhagen Lighthouse\//, "").split("/");
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
    const flows = [
      ...new Set(
        rows
          .map((r) => r.flow ?? r.Flow ?? r.FLOW ?? r.direction ?? r.Direction)
          .filter(Boolean)
          .map(String)
      ),
    ].sort();
    const classifications = [
      ...new Set(
        rows
          .map((r) => r.classification ?? r.Classification ?? r.mode ?? r.Mode)
          .filter(Boolean)
          .map(String)
      ),
    ].sort();
    sheets[name] = {
      rowCount: rows.length,
      headers: headers.slice(0, 20),
      flows: flows.slice(0, 30),
      flowCount: flows.length,
      classifications: classifications.slice(0, 20),
      classificationCount: classifications.length,
    };
  }
  return { sheetNames: wb.SheetNames, sheets };
}

function inspectCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = (lines[0] || "").split(/[,;]/);
  return { rowCount: Math.max(0, lines.length - 1), headers };
}

function main() {
  const members = listZipMembers();
  const xlsxMembers = members.filter((m) => /\.xlsx$/i.test(m));
  const csvMembers = members.filter((m) => /\.csv$/i.test(m));

  const keyMembers = members.filter((m) => KEY_XLSX_PATTERNS.some((re) => re.test(m)));

  const inspected = [];
  for (const member of keyMembers) {
    try {
      const local = extractMember(member);
      const shortName = member.replace(/^Copenhagen Lighthouse\//, "");
      if (/\.csv$/i.test(member)) {
        inspected.push({ path: shortName, type: "csv", ...inspectCsv(local) });
      } else {
        inspected.push({ path: shortName, type: "xlsx", ...inspectXlsx(local) });
      }
    } catch (err) {
      inspected.push({
        path: member.replace(/^Copenhagen Lighthouse\//, ""),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    zip: "Copenhagen Lighthouse-20260625T113853Z-3-001.zip",
    totals: {
      allFiles: members.length,
      xlsx: xlsxMembers.length,
      csv: csvMembers.length,
      images: members.filter((m) => /\.(png|jpg|jpeg|gif)$/i.test(m)).length,
      pdfs: members.filter((m) => /\.pdf$/i.test(m)).length,
      shapefiles: members.filter((m) => /\.(shp|dbf|shx)$/i.test(m)).length,
    },
    folderSummary: folderSummary(members).map(([folder, count]) => ({ folder, count })),
    keyFilesInspected: inspected,
    allXlsxPaths: xlsxMembers.map((m) => m.replace(/^Copenhagen Lighthouse\//, "")),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(`Files: ${report.totals.allFiles} | xlsx: ${report.totals.xlsx} | inspected: ${inspected.length}`);
}

main();
