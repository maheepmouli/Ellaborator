# WP7 Compliance Layer

Operator guide for the ELLABORATOR **WP7 submission/compliance** surface.

## Purpose

Cities supply **underlying data + metadata**. WP7 calculates KPIs.

This layer does **not** replace the map explorer. It scores each city × KPI as:

| Status | Meaning |
|--------|---------|
| **Ready** | Right-type evidence present + required metadata complete + not mock |
| **Partial** | Evidence present but incomplete metadata, wrong proxy, or draft parser |
| **Missing** | No linked evidence of the right type (or mock-only) |

## Spec

Aligned to **WP7 City Data Specification (FINAL January 2026)** — universal metadata + seven KPI evidence types (1.1–4.2).

## In-app

- Page: [`/wp7-compliance`](/wp7-compliance)
- Linked from [Data Catalogue](/data-catalogue)
- Insight panel: when panel/map evidence diverge, a short note links to WP7 Compliance

## Code map

| Area | Path |
|------|------|
| Types | `src/data/wp7/wp7Types.ts` |
| Evidence overlays | `src/data/wp7/wp7EvidenceOverrides.ts` |
| Adapter | `src/data/wp7/adaptDataset.ts` |
| Rules | `src/lib/wp7/kpiEvidenceRules.ts` |
| Scorer | `src/lib/wp7/complianceScorer.ts` |
| Matrix | `src/lib/wp7/cityComplianceMatrix.ts` |
| Export | `src/lib/wp7/exportWp7Package.ts` |
| UI | `src/pages/Wp7Compliance.tsx` |

Existing `DATASET_REGISTRY` in `src/data/datasetMetadata.ts` is **not** replaced — WP7 adapts it and applies honest KPI overrides (e.g. Telraam ≠ expansion plan).

## Export package

**Export WP7 package** downloads:

1. `wp7-submission-package-*.json` — `manifest.json` + `datasets` map + embedded CSV + `readme.txt`
2. `wp7-kpi-evidence-summary-*.csv` — one row per city × KPI

Export is **submission-assist**, not a claim that WP7 calculation is finished. Aggregated metadata only (no respondent PII).

## Helsinki reference rules

- **KPI 1.1** — not Ready without a formal expansion-plan artifact (monitoring / footprints are wrong proxies)
- **KPI 3.2** — attitude survey alone is not Ready; heat (B) and circular (C) stay Missing until the city provides data
- **KPI 4.1** — Viikki UX survey (`n=50`, method, ≥75% target recorded even if unmet) is the Ready reference

## Tests

```bash
npm run test:wp7
```

Asserts Helsinki 4.1 Ready, Helsinki 1.1 not Ready, mock Issy 4.1 Missing, and a full 6×7 matrix.

## Extending a city

1. Add or edit an entry in `WP7_EVIDENCE_OVERRIDES` keyed by registry `id`
2. Set `linkedKpisOverride` / `wrongProxyForKpis` when registry links are dishonest
3. Fill `kpiEvidence` for the relevant KPIs
4. Re-run `npm run test:wp7` and check `/wp7-compliance`

Do **not** invent partner surveys, plans, heat maps, or circular-materials inventories to force Ready.
