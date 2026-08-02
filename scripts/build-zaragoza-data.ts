/**
 * Build committed Zaragoza JSON bundles from extracted SharePoint mirror.
 * Run: npm run extract-sharepoint && npm run build-zaragoza-data
 *
 * Deployments exclude public/sharepoint-data/ — this snapshot keeps P1/P2
 * observatory + map hubs working without the local mirror.
 */
import fs from "node:fs/promises";
import { existsSync, readFileSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseZaragozaSupplementalRecords } from "../src/services/zaragozaParsers.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const SP = path.join(PUBLIC, "sharepoint-data", "Zaragoza");
const OUT = path.join(PUBLIC, "data", "zaragoza");
const KPIS = ["kpi1.1", "kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.1", "kpi4.2"] as const;

function fileResponse(filePath: string) {
  if (!existsSync(filePath)) {
    return {
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
      json: async () => {
        throw new Error(`404 ${filePath}`);
      },
    };
  }
  const buf = readFileSync(filePath);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    json: async () => JSON.parse(buf.toString("utf8")),
  };
}

/** Browser parsers fetch /sharepoint-data/... — map those URLs onto the local mirror. */
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const raw = decodeURIComponent(String(input));
  const urlPath = raw.replace(/^https?:\/\/[^/]+/, "");
  if (!urlPath.startsWith("/")) {
    throw new Error(`Unexpected fetch URL in Zaragoza build: ${raw}`);
  }
  return fileResponse(path.join(PUBLIC, urlPath.slice(1))) as unknown as Response;
}) as typeof fetch;

async function main() {
  if (!existsSync(SP)) {
    console.warn(
      "SharePoint Zaragoza mirror missing — keeping existing public/data/zaragoza bundles if present."
    );
    if (!existsSync(path.join(OUT, "observed-records.json"))) {
      process.exitCode = 1;
      console.error("No Zaragoza mirror and no existing observed-records.json");
    }
    return;
  }

  mkdirSync(OUT, { recursive: true });

  const byKpi: Record<string, unknown[]> = {};
  let total = 0;
  for (const kpiId of KPIS) {
    const records = await parseZaragozaSupplementalRecords(kpiId);
    byKpi[kpiId] = records.map((r) => ({
      ...r,
      sourceFile: String(r.sourceFile || "").replace(
        /^\/sharepoint-data\//,
        "bundled://zaragoza/"
      ),
      spatialNote: r.spatialNote
        ? `${r.spatialNote} · bundled deploy fallback`
        : "bundled deploy fallback",
    }));
    total += byKpi[kpiId].length;
    console.log(`  ${kpiId}: ${byKpi[kpiId].length} records`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "SharePoint Zaragoza baseline mirror → bundled JSON fallback",
    note: "Used when /sharepoint-data/Zaragoza is unavailable (production / Vercel).",
    byKpi,
  };

  const outPath = path.join(OUT, "observed-records.json");
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath} (${total} records across ${KPIS.length} KPIs)`);

  const centroidsSrc = path.join(SP, "intervention-areas-centroids.geojson");
  const centroidsDest = path.join(OUT, "intervention-areas-centroids.geojson");
  if (existsSync(centroidsSrc)) {
    copyFileSync(centroidsSrc, centroidsDest);
    console.log(`Copied intervention-areas-centroids.geojson`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
