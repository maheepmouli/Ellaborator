#!/usr/bin/env node
/**
 * Refresh committed Helsinki JSON snapshots from optional live partner APIs.
 * Falls back to npm run build-helsinki-data when no live APIs are configured.
 *
 * Usage: npm run refresh-helsinki-snapshots
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const liveConfigured =
  process.env.HELSINKI_TELRAAM_API_URL ||
  process.env.HELSINKI_HSL_API_URL ||
  process.env.HELSINKI_INNOTRAFIK_API_URL ||
  process.env.HELSINKI_SEE_SENSE_API_URL;

if (!liveConfigured) {
  console.log("No HELSINKI_* live API env vars set — running build-helsinki-data from SharePoint mirror.");
  execFileSync("npm", ["run", "build-helsinki-data"], { stdio: "inherit", cwd: ROOT });
  process.exit(0);
}

console.warn(
  "Live Helsinki API refresh is not yet wired — set HELSINKI_* URLs in CI when partner endpoints are available."
);
execFileSync("npm", ["run", "build-helsinki-data"], { stdio: "inherit", cwd: ROOT });
