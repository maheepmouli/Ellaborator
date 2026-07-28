#!/usr/bin/env node
/**
 * Runs WP7 compliance scorer self-checks via tsx.
 */
import { runWp7SelfChecks } from "../src/lib/wp7/complianceScorer.selftest.ts";

try {
  runWp7SelfChecks();
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
