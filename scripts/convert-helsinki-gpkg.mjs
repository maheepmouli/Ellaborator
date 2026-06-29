#!/usr/bin/env node
/**
 * Convert Helsinki .gpkg assets (and Zaragoza intervention centroids) to GeoJSON.
 * Requires Python with geopandas. Run after: npm run extract-sharepoint
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP = path.join(ROOT, "public", "sharepoint-data");
const PY = path.join(ROOT, "scripts", "convert-geospatial.py");

if (!fs.existsSync(SP)) {
  console.error("Missing public/sharepoint-data/. Run: npm run extract-sharepoint");
  process.exit(1);
}

try {
  execSync(`python "${PY}"`, { stdio: "inherit", cwd: ROOT });
} catch {
  console.error("Conversion failed. Install geopandas: pip install geopandas");
  process.exit(1);
}
