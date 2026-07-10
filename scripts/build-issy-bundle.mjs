#!/usr/bin/env node
/**
 * Build committed Issy evidence bundle from extracted SharePoint mirror.
 * Run: npm run extract-sharepoint && npm run build-issy-bundle
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP = path.join(ROOT, "public", "sharepoint-data", "Issy-20260625T113904Z-3-001", "Issy");
const OUT = path.join(ROOT, "public", "data", "issy");
const SP_BASE = "/sharepoint-data/Issy-20260625T113904Z-3-001/Issy";
const MAX_BUNDLE_BYTES = 95 * 1024 * 1024;

async function copyIfSmall(srcRel, destSubdir, destName) {
  const src = path.join(SP, ...srcRel.split("/"));
  const destDir = path.join(OUT, destSubdir);
  const destFile = destName ?? path.basename(srcRel);
  const dest = path.join(destDir, destFile);
  try {
    const stat = await fs.stat(src);
    if (stat.size > MAX_BUNDLE_BYTES) {
      console.warn(`Skipping bundle copy ${srcRel} (${Math.round(stat.size / 1024 / 1024)} MB)`);
      return null;
    }
    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(src, dest);
    return `/data/issy/${destSubdir}/${destFile}`.replace(/\\/g, "/");
  } catch (err) {
    console.warn(`Could not bundle ${srcRel}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function buildEvidenceManifest({ imagePath, pdfPath }) {
  return [
    {
      id: "issy-p1-interventions",
      pilotId: "issy-p1",
      title: "Issy ELABORATOR pilots",
      type: "narrative",
      linkedDatasetIds: [
        "issy-flow-baseline-csv",
        "issy-flow-post-csv",
        "issy-wintics-baseline-xlsx",
        "issy-classeur-emissions-xlsx",
      ],
      linkedMethods: [
        "Luminous bicycle markings (Pilot 1)",
        "Mobility observatory (Pilot 2)",
        "GecoAir citizen app (Pilot 3)",
      ],
      fallback: {
        type: "narrative",
        text: "June 2026 SharePoint drop: zone OD CSVs integrated for KPI 1.2; Wintics site counts and ASIF emissions workbook catalogued for Pilot 1; live traficissy API for junction arms.",
      },
    },
    {
      id: "issy-p1-wintics-baseline",
      pilotId: "issy-p1",
      title: "Wintics camera — baseline site counts",
      type: "narrative",
      linkedDatasetIds: ["issy-wintics-baseline-xlsx"],
      linkedMethods: ["Wintics automated counts at living-lab site"],
      fallback: {
        type: "narrative",
        text: "Baseline modal share ~20.5% cyclists at LL site (Wintics). Distinct from city-wide zone OD CSV — point measurement, not district OD matrix.",
      },
    },
    {
      id: "issy-p1-site-photo",
      pilotId: "issy-p1",
      title: "Intervention site photo (Monica 2024)",
      type: imagePath ? "image" : "narrative",
      path: imagePath ?? undefined,
      linkedDatasetIds: ["issy-media-gallery"],
      linkedMethods: ["Baseline site documentation"],
      caption: "Photo from Monica 2024 baseline capture at the luminous markings pilot site.",
      fallback: {
        type: "narrative",
        text: "Site photo not bundled — run extract-sharepoint and build-issy-bundle.",
      },
    },
    {
      id: "issy-p1-flowell-synthesis",
      pilotId: "issy-p1",
      title: "FLOWELL T0–T1 synthesis",
      type: pdfPath ? "pdf" : "narrative",
      path: pdfPath ?? `${SP_BASE}/1. BASELINE DATA from Issy/FLOWELL ISSY - T0-T1 SYNTHESIS .pdf`,
      linkedDatasetIds: ["issy-flowell-synthesis-pdf"],
      linkedMethods: ["Partner synthesis report"],
      caption: "FLOWELL Issy baseline synthesis — open from SharePoint mirror when bundled copy unavailable.",
      fallback: {
        type: "narrative",
        text: "Synthesis PDF available in SharePoint mirror after extract-sharepoint.",
      },
    },
    {
      id: "issy-p2-observatory",
      pilotId: "issy-p2",
      title: "Mobility observatory",
      type: "narrative",
      linkedDatasetIds: ["issy-traffic-api", "issy-flow-baseline-csv", "issy-flow-post-csv"],
      linkedMethods: ["traficissy segment API", "Zone OD CSV"],
      fallback: {
        type: "narrative",
        text: "Flagship junction observatory at Stalingrad — segment arms from live API; city-view KPI 1.2 from OD CSV.",
      },
    },
    {
      id: "issy-p2-zero-emission-api",
      pilotId: "issy-p2",
      title: "KPI 3.1 — Zero-emission facilities (live API)",
      type: "narrative",
      linkedDatasetIds: ["issy-cycling-infra-api"],
      linkedMethods: [
        "Cycling infrastructure API",
        "EV charging / bike parking / hub facility counts",
      ],
      fallback: {
        type: "narrative",
        text: "No ZEM facility workbook in the SharePoint drop (requirements: NA for all pilots). KPI 3.1 uses the city cycling infrastructure API when available — observed geometry on map, facility-type breakdown in sidebar.",
      },
    },
    {
      id: "issy-p3-gecoair",
      pilotId: "issy-p3",
      title: "GecoAir & emissions context",
      type: "narrative",
      linkedDatasetIds: ["issy-classeur-emissions-xlsx"],
      linkedMethods: ["GecoAir app (in progress)", "ASIF modelled CO₂"],
      fallback: {
        type: "narrative",
        text: "GecoAir data in progress per requirements matrix. Classeur ASIF workbook provides modelled corridor CO₂ baseline until app feeds arrive.",
      },
    },
    {
      id: "issy-p1-baseline-video",
      pilotId: "issy-p1",
      title: "Baseline intervention videos",
      type: "narrative",
      linkedDatasetIds: ["issy-media-gallery"],
      linkedMethods: ["Video documentation (T0)"],
      fallback: {
        type: "narrative",
        text: "~630 MB of mp4/mov in SharePoint zip — extract with: node scripts/extract-sharepoint-june2026.mjs --include-issy-media",
      },
    },
    {
      id: "issy-engagements-may2025",
      pilotId: "issy-p2",
      title: "One2One engagement — May 2025",
      type: "narrative",
      linkedDatasetIds: ["issy-engagements-bundle"],
      linkedMethods: ["City stakeholder meeting"],
      fallback: {
        type: "narrative",
        text: "Attendance, notes, and transcript for Issy 14 May 2025 One2One — catalogued under engagements folder.",
      },
    },
    {
      id: "issy-engagements-mar2026",
      pilotId: "issy-p2",
      title: "One2One engagement — March 2026",
      type: "narrative",
      linkedDatasetIds: ["issy-engagements-bundle"],
      linkedMethods: ["City stakeholder meeting"],
      fallback: {
        type: "narrative",
        text: "Attendance, AI notes, and transcript for Issy 13 March 2026 One2One.",
      },
    },
  ];
}

async function main() {
  await fs.mkdir(path.join(OUT, "media"), { recursive: true });

  const imagePath = await copyIfSmall("media/image.jpg", "media", "site-photo-monica-2024.jpg");

  const bundledImage = imagePath;

  const pdfBundled = await copyIfSmall(
    "1. BASELINE DATA from Issy/FLOWELL ISSY - T0-T1 SYNTHESIS .pdf",
    "docs",
    "flowell-issy-t0-t1-synthesis.pdf"
  );

  const manifest = buildEvidenceManifest({
    imagePath: bundledImage,
    pdfPath: pdfBundled,
  });

  await fs.writeFile(
    path.join(OUT, "evidence-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  console.log(`Wrote evidence-manifest.json (${manifest.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
