#!/usr/bin/env node
/**
 * Build public/data/milan/accessibility-points.json from DSS routing shapefiles.
 * Prefer extracted SharePoint mirror; fall back to .tmp-milan-a11y unzip staging.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-milan-data.mjs")], {
  cwd: ROOT,
  env: { ...process.env, MILAN_BUILD_ACCESSIBILITY_ONLY: "1" },
  stdio: "inherit",
  maxBuffer: 80 * 1024 * 1024,
});
process.exit(result.status ?? 1);
