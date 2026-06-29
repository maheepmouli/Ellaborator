# Helsinki Data Audit

## Scope

This audit supports the intervention-first Helsinki rollout in the city observatory standardization phase.

## Files requested for inspection

- `Helsinki_Intervention_Locations_EPSG3067.gpkg`
- `DangerousLocationsSurvey_ENG_EPSG3067.gpkg`
- `Helsinki_eScooter_Observations.zip`
- KML / Google My Maps intervention references

## Current repository check result

The files above are **not present in the current local repository snapshot**.  
No local `.gpkg`, `.zip`, or `.kml` assets matching the provided Helsinki filenames were detected.

## What can be displayed immediately

### Pilot 1 — Safety Sense Helsinki

- Intervention marker can be shown as an explicit placeholder at pilot anchor.
- Status in UI: **Data pending**.
- Baseline/post status: **Pending / Pending**.

### Pilot 2 — E-scooter parking intervention

- Two official intervention markers are now wired with exact coordinates:
  - Site A: `60.166009, 24.938293`
  - Site B: `60.190069, 24.960750`
- Intervention-first fly-to and pilot-focused highlight are enabled.
- Popups include intervention type, coordinate, and baseline/post availability.

### Pilot 3 — Citywide active mobility behavior

- Pilot-level intervention entry is available in the profile framework.
- Geometry-linked observed datasets are still partial/pending.

## Baseline and post-intervention readiness

- Baseline: **Partially available** via existing Helsinki observed streams.
- Post-intervention: **Pending/partial**, depends on partner-delivered datasets and linkage.
- Geometry quality: currently point-based intervention anchors with pending authoritative geometry ingestion.

## Dangerous locations survey linkage (Pilot 1)

Without `DangerousLocationsSurvey_ENG_EPSG3067.gpkg` in the workspace, linkage cannot be validated yet.

Planned linkage once file is delivered:

1. Verify geometry type (point/line/polygon) and CRS.
2. Match survey points to Pilot 1 intervention extent.
3. Expose counts and confidence in observatory Data tab.

## Remaining data gaps

- Intervention geometry package (`Helsinki_Intervention_Locations_EPSG3067.gpkg`) not ingested yet.
- Dangerous locations survey package not available locally.
- eScooter observation archive not available locally.
- KML/My Maps references not available locally.
- Post-intervention dataset completeness still pending partner sync.

## Recommended pilot representation

- **Pilot 1:** placeholder intervention marker + explicit missing-data notices.
- **Pilot 2:** exact monitored site markers (now active) + intervention-first focus.
- **Pilot 3:** area/intervention profile card + readiness warning until geometry and post datasets are delivered.
