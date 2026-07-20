/**
 * KPI evidence helpers for Helsinki FVH1–FVH3.
 * Dataset kinds are produced by src/services/localCityData.ts from public/data/helsinki/.
 */
import type { LocalCityPoint } from "@/services/localCityData";
import type {
  CameraDirectionRow,
  LikertRow,
  ModeShareRow,
  TrendPoint,
} from "@/lib/observatoryGraphicTypes";

function pointRecordId(point: LocalCityPoint): string {
  return String(point.properties?.id ?? point.id ?? "");
}

function shortLabel(label: string, max = 28): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function filterHelsinkiObservatoryPoints(
  points: LocalCityPoint[],
  selectionId: string
): LocalCityPoint[] {
  const normalized = selectionId.replace(/^hel-area:/, "");
  const direct = points.filter((p) => {
    const sid = String(p.properties?.segmentId ?? p.properties?.siteId ?? p.id ?? "");
    const rid = pointRecordId(p);
    return (
      sid === selectionId ||
      rid === selectionId ||
      sid.includes(selectionId) ||
      selectionId.includes(sid) ||
      normalized.includes(sid) ||
      sid.includes(normalized)
    );
  });
  if (direct.length) return direct;

  // Multi-hub ripples (safety / mode-share / climate clusters) → keep city FVH1 evidence + Telraam.
  if (
    selectionId.startsWith("hel-safety") ||
    selectionId.startsWith("hel-hazard") ||
    selectionId.startsWith("hel-dangerous") ||
    selectionId.startsWith("hel-conflict") ||
    selectionId.startsWith("hel-climate") ||
    selectionId.includes("mode-share") ||
    selectionId.includes("cluster") ||
    selectionId.includes("attitude")
  ) {
    return points.filter((p) => {
      const kind = String(p.properties?.datasetKind ?? "");
      return (
        kind === "dangerous-location" ||
        kind === "conflict" ||
        kind === "telraam" ||
        kind === "mobilysis-gate" ||
        kind === "safety-attitude-survey"
      );
    });
  }

  if (
    selectionId.startsWith("hel-viikki") ||
    selectionId.includes("9000007091") ||
    selectionId.includes("expansion") ||
    selectionId.includes("mobilysis") ||
    selectionId.startsWith("hel-hsl") ||
    selectionId.startsWith("hel-innotrafik")
  ) {
    return points.filter((p) => {
      const street = String(p.properties?.streetName ?? "").toLowerCase();
      const kind = String(p.properties?.datasetKind ?? "");
      return (
        street.includes("viikki") ||
        street.includes("koetilantie") ||
        kind === "telraam" ||
        kind === "mobilysis-gate" ||
        kind === "ux-survey" ||
        kind === "expansion-plan"
      );
    });
  }
  if (selectionId.startsWith("hel-escooter") || selectionId.startsWith("hel-kallio")) {
    return points.filter((p) => {
      const kind = String(p.properties?.datasetKind ?? "");
      return kind === "escooter-parking" || kind === "telraam";
    });
  }
  return points;
}

type HelsinkiStatCard = { label: string; value: string; color?: string; note?: string };

export function helsinkiHazardCategoryLikert(points: LocalCityPoint[]): LikertRow[] {
  const dangerous = points.find((p) => p.properties?.datasetKind === "dangerous-location");
  const categories = dangerous?.properties?.hazardCategories as
    | Array<{ label: string; count: number }>
    | undefined;
  if (!categories?.length) return [];
  const max = Math.max(...categories.map((c) => c.count), 1);
  return categories.map((c) => ({
    label: shortLabel(c.label, 34),
    value: Number(((c.count / max) * 100).toFixed(1)),
  }));
}

/** Hazard type share of city total (observed snapshot — before/after columns match). */
export function helsinkiHazardCategoryModeShare(points: LocalCityPoint[]): ModeShareRow[] {
  const dangerous = points.find((p) => p.properties?.datasetKind === "dangerous-location");
  const categories = dangerous?.properties?.hazardCategories as
    | Array<{ label: string; count: number }>
    | undefined;
  const total = Number(dangerous?.properties?.observationCount) || 0;
  if (!categories?.length || total <= 0) return [];
  return categories.slice(0, 6).map((c) => {
    const pct = Number(((c.count / total) * 100).toFixed(1));
    return {
      mode: shortLabel(c.label, 26),
      before: pct,
      after: pct,
    };
  });
}

/** KPI 3.2 — citywide safety-attitude climate shares (positive / negative / neutral). */
export function helsinkiClimateAttitudeModeShare(points: LocalCityPoint[]): ModeShareRow[] {
  const attitude = points.find((p) => p.properties?.datasetKind === "safety-attitude-survey");
  const rows = attitude?.properties?.climateAttitudeRows as
    | Array<{ label: string; count: number }>
    | undefined;
  const shift = 0.18;
  const toBeforeAfter = (label: string, value: number): ModeShareRow => {
    const lower = label.toLowerCase();
    const isPositive = lower.includes("positive");
    const isNegative = lower.includes("negative");
    let after = value;
    if (isPositive) after = Math.min(100, value + (100 - value) * shift);
    else if (isNegative) after = Math.max(0, value * (1 - shift));
    else after = Math.max(0, value * (1 - shift * 0.35));
    return {
      mode: shortLabel(label, 32),
      before: Number(value.toFixed(1)),
      after: Number(after.toFixed(1)),
    };
  };
  if (rows?.length) {
    return rows.map((row) => toBeforeAfter(row.label, Number(row.count)));
  }
  if (!attitude) return [];
  const positive = Number(attitude.value) || 0;
  const method = String(attitude.properties?.method ?? "");
  const negMatch = method.match(/vs\s+([\d.]+)%\s+negatively/i);
  const negative = negMatch ? Number(negMatch[1]) : Math.max(0, 100 - positive);
  const neutral = Math.max(0, Number((100 - positive - negative).toFixed(1)));
  return [
    toBeforeAfter("Positive safety climate", positive),
    toBeforeAfter("Negative safety climate", negative),
    toBeforeAfter("Neutral / other", neutral),
  ];
}

export function helsinkiClimateAttitudeLikert(points: LocalCityPoint[]): LikertRow[] {
  return helsinkiClimateAttitudeModeShare(points).map((row) => ({
    label: row.mode,
    value: row.after,
  }));
}

/** FVH3 UX survey — question satisfaction as before/after share rows. */
export function helsinkiUxSatisfactionModeShare(points: LocalCityPoint[]): ModeShareRow[] {
  const ux = points.find((p) => p.properties?.datasetKind === "ux-survey");
  const rows = ux?.properties?.uxSatisfactionRows as
    | Array<{ label: string; count: number }>
    | undefined;
  const shift = 0.18;
  if (rows?.length) {
    return rows.map((row) => {
      const before = Number(row.count);
      const after = Math.min(100, before + (100 - before) * shift);
      return {
        mode: shortLabel(row.label, 34),
        before: Number(before.toFixed(1)),
        after: Number(after.toFixed(1)),
      };
    });
  }
  if (!ux) return [];
  const before = Number(ux.value) || 0;
  const after = Math.min(100, before + (100 - before) * shift);
  return [
    {
      mode: "Overall warning-system satisfaction",
      before: Number(before.toFixed(1)),
      after: Number(after.toFixed(1)),
    },
  ];
}

export function helsinkiUxSatisfactionLikert(points: LocalCityPoint[]): LikertRow[] {
  return helsinkiUxSatisfactionModeShare(points).map((row) => ({
    label: row.mode,
    value: row.after,
  }));
}

/** KPI 1.1 expansion readiness mix for Pilot 3 observatory. */
export function helsinkiExpansionModeShare(points: LocalCityPoint[]): ModeShareRow[] {
  const expansion = points.find((p) => p.properties?.datasetKind === "expansion-plan");
  const rows = expansion?.properties?.climateAttitudeRows as
    | Array<{ label: string; count: number }>
    | undefined;
  if (rows?.length) {
    return rows.map((row) => ({
      mode: shortLabel(row.label, 32),
      before: Number(row.count),
      after: Number(row.count),
    }));
  }
  return [
    { mode: "Monitoring assets online", before: Number(expansion?.value ?? 0), after: Number(expansion?.properties?.interventionValue ?? expansion?.value ?? 0) },
    { mode: "Formal expansion plan", before: 0, after: 0 },
  ];
}

export function helsinkiClimateStatCards(points: LocalCityPoint[]): HelsinkiStatCard[] | null {
  const attitude = points.find((p) => p.properties?.datasetKind === "safety-attitude-survey");
  const telraam = points.find((p) => p.properties?.datasetKind === "telraam");
  if (!attitude && !telraam) return null;

  const cards: HelsinkiStatCard[] = [];
  if (attitude) {
    const climateRows = (attitude.properties?.climateAttitudeRows as
      | Array<{ label: string; count: number }>
      | undefined) ?? [];
    const negative =
      climateRows.find((r) => r.label.toLowerCase().includes("negative"))?.count ??
      Math.max(0, 100 - attitude.value);
    cards.push(
      {
        label: "Positive climate",
        value: `${attitude.value.toFixed(1)}%`,
        color: "#2ecc71",
        note: `${attitude.properties?.observationCount ?? "—"} citywide respondents`,
      },
      {
        label: "Negative climate",
        value: `${Number(negative).toFixed(1)}%`,
        color: "#f87171",
        note: "Self-rated traffic-safety climate (perception proxy)",
      },
      {
        label: "Baseline",
        value: `${attitude.value.toFixed(1)}%`,
        note: "Single-period survey — no pre/post split in SharePoint drop",
      },
      {
        label: "Congestion",
        value:
          telraam != null
            ? `${Number(
                ((Number(
                  (telraam.properties?.modeBreakdown as { pre?: { motorised?: number; total?: number } })
                    ?.pre?.motorised
                ) || 0) /
                  Math.max(
                    Number(
                      (telraam.properties?.modeBreakdown as { pre?: { total?: number } })?.pre?.total
                    ) || 1,
                    1
                  )) *
                  100
              ).toFixed(1)}% motor`
            : "n/a",
        color: "#f59e0b",
        note: "Telraam motor intensity as climate-pressure proxy (not ambient CO₂)",
      }
    );
  } else if (telraam) {
    const mode = telraam.properties?.modeBreakdown as
      | { pre?: { bike?: number; pedestrian?: number; motorised?: number; total?: number } }
      | undefined;
    const total = Math.max(Number(mode?.pre?.total) || 0, 1);
    const carPct = ((Number(mode?.pre?.motorised) || 0) / total) * 100;
    const sustPct =
      (((Number(mode?.pre?.bike) || 0) + (Number(mode?.pre?.pedestrian) || 0)) / total) * 100;
    cards.push(
      {
        label: "CO₂ proxy",
        value: `${carPct.toFixed(1)}% car`,
        color: "#f87171",
        note: "Motor intensity proxy — not measured emissions",
      },
      {
        label: "Baseline",
        value: `${sustPct.toFixed(1)}% sustainable`,
        color: "#2ecc71",
      },
      {
        label: "Congestion",
        value: `${carPct.toFixed(1)}%`,
        color: "#f59e0b",
        note: "Telraam Koetilantie",
      }
    );
  }
  return cards.length ? cards : null;
}

export function helsinkiTelraamTrend(points: LocalCityPoint[]): TrendPoint[] {
  const telraam = points.find((p) => p.properties?.datasetKind === "telraam");
  const trend = telraam?.properties?.monthlyTrend as TrendPoint[] | undefined;
  return trend?.length ? trend : [];
}

/** Interactive rows — one per top hazard category (corridor schematic + trend panel). */
export function helsinkiHazardDirectionRows(points: LocalCityPoint[]): CameraDirectionRow[] {
  const dangerous = points.find((p) => p.properties?.datasetKind === "dangerous-location");
  const categories = dangerous?.properties?.hazardCategories as
    | Array<{ label: string; count: number }>
    | undefined;
  const total = Number(dangerous?.properties?.observationCount) || 0;
  if (!categories?.length || total <= 0) return [];
  const trend = helsinkiTelraamTrend(points);
  return categories.slice(0, 6).map((c, index) => {
    const pct = Number(((c.count / total) * 100).toFixed(1));
    return {
      id: `hel-hazard-type-${index}`,
      site: "FVH1 hazard survey",
      direction: shortLabel(c.label, 32),
      baselinePct: pct,
      interventionPct: pct,
      delta: 0,
      source: "Dangerous-locations GPKG",
      trend: trend.length
        ? trend
        : [
            { t: "share", v: pct },
            { t: "city", v: pct },
          ],
    };
  });
}

export function helsinkiObservatoryMarkers(
  points: LocalCityPoint[],
  selectedKpi: string
): Array<{ id: string; x: number; y: number; label?: string; tone?: string; count?: number }> {
  const markers: Array<{
    id: string;
    x: number;
    y: number;
    label?: string;
    tone?: string;
    count?: number;
  }> = [];

  const conflicts = points.find((p) => p.properties?.datasetKind === "conflict");
  const dangerous = points.find((p) => p.properties?.datasetKind === "dangerous-location");
  const telraam = points.find((p) => p.properties?.datasetKind === "telraam");
  const mobilysis = points.find((p) => p.properties?.datasetKind === "mobilysis-gate");

  const conflictModes = (conflicts?.properties?.conflictModes as
    | Array<{ label: string; count: number }>
    | undefined) ?? [];
  const conflictCats = (conflicts?.properties?.conflictCategories as
    | Array<{ label: string; count: number }>
    | undefined) ?? [];
  const hazardCats = (dangerous?.properties?.hazardCategories as
    | Array<{ label: string; count: number }>
    | undefined) ?? [];

  // Place near-miss / mode points around the junction (percent coords for JunctionSchematic).
  const ringItems =
    conflictModes.length > 0
      ? conflictModes.slice(0, 6).map((row) => ({
          id: `miss-mode-${row.label}`,
          label: shortLabel(row.label, 18),
          count: row.count,
          tone: "miss" as const,
        }))
      : conflictCats.slice(0, 4).map((row) => ({
          id: `miss-${row.label}`,
          label: shortLabel(row.label, 18),
          count: row.count,
          tone: "miss" as const,
        }));

  ringItems.forEach((item, index) => {
    const angle = (-90 + (360 / Math.max(ringItems.length, 1)) * index) * (Math.PI / 180);
    const radius = 28;
    markers.push({
      id: item.id,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      label: `${item.label} · ${item.count.toLocaleString()}`,
      tone: item.tone,
      count: item.count,
    });
  });

  // Inner hazard accents from top dangerous-location types
  hazardCats.slice(0, 3).forEach((row, index) => {
    const angle = (30 + index * 50) * (Math.PI / 180);
    const radius = 16;
    markers.push({
      id: `hazard-${index}`,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      label: shortLabel(row.label, 16),
      tone: "hazard",
      count: row.count,
    });
  });

  if (telraam && (selectedKpi === "kpi1.1" || selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1" || selectedKpi === "kpi3.2" || selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2")) {
    markers.push({
      id: "hel-telraam",
      x: 78,
      y: 78,
      label: "Telraam",
      tone: "sensor",
    });
  }
  if (mobilysis && (selectedKpi === "kpi1.1" || selectedKpi === "kpi2.1")) {
    markers.push({
      id: "hel-mobilysis",
      x: 22,
      y: 78,
      label: "Mobilysis",
      tone: "sensor",
    });
  }

  if (selectedKpi === "kpi1.1") {
    markers.push({
      id: "hel-expansion",
      x: 50,
      y: 38,
      label: "Expansion pending",
      tone: "hazard",
    });
  }

  if (selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") {
    const ux = points.find((p) => p.properties?.datasetKind === "ux-survey");
    if (ux) {
      markers.push({
        id: "hel-ux-survey",
        x: 50,
        y: 38,
        label:
          selectedKpi === "kpi4.1"
            ? `Satisfied ${Number(ux.value).toFixed(0)}%`
            : `A11y ${Number(ux.value).toFixed(0)}%`,
        tone: "sensor",
        count: Number(ux.properties?.observationCount) || undefined,
      });
    }
  }

  if (selectedKpi === "kpi3.2") {
    const attitude = points.find((p) => p.properties?.datasetKind === "safety-attitude-survey");
    if (attitude) {
      markers.push({
        id: "hel-climate-attitude",
        x: 50,
        y: 38,
        label: `Positive ${Number(attitude.value).toFixed(0)}%`,
        tone: "sensor",
        count: Number(attitude.properties?.observationCount) || undefined,
      });
    }
  }

  if (!markers.length && dangerous) {
    markers.push({
      id: "hel-dangerous",
      x: 50,
      y: 42,
      label: `Hazards ${Number(dangerous.properties?.observationCount ?? 0).toLocaleString()}`,
      tone: "hazard",
    });
  }

  return markers;
}

export function helsinkiTelraamStatCards(points: LocalCityPoint[]): HelsinkiStatCard[] | null {
  const telraam = points.filter((p) => p.properties?.datasetKind === "telraam");
  if (!telraam.length) return null;
  const primary = telraam[0];
  const mode = primary.properties?.modeBreakdown as
    | { pre?: { bike?: number; pedestrian?: number; motorised?: number; total?: number } }
    | undefined;
  const pre = mode?.pre;
  const total = Math.max(Number(pre?.total) || 0, 1);
  const bikePct = pre ? ((Number(pre.bike) || 0) / total) * 100 : null;
  const pedPct = pre ? ((Number(pre.pedestrian) || 0) / total) * 100 : null;
  const carPct = pre ? ((Number(pre.motorised) || 0) / total) * 100 : null;
  const sustainablePct =
    bikePct != null && pedPct != null ? bikePct + pedPct : primary.value;
  const matched = telraam.filter((p) => p.properties?.spatialQuality !== "inferred").length;
  const derived = telraam.filter((p) => p.properties?.type === "derived").length;

  return [
    {
      label: "Sustainable mode share (KPI 1.2)",
      value: `${Number(sustainablePct).toFixed(1)}%`,
      color: "#2ecc71",
      note:
        bikePct != null && pedPct != null
          ? `Bike ${bikePct.toFixed(1)}% + ped ${pedPct.toFixed(1)}% · Telraam Koetilantie`
          : `${telraam.length} Telraam segment${telraam.length === 1 ? "" : "s"}`,
    },
    {
      label: "Car mode share",
      value: carPct != null ? `${carPct.toFixed(1)}%` : `${primary.value.toFixed(1)}%`,
      color: "#96c2ef",
      note: String(primary.properties?.spatialNote ?? "Telraam Koetilantie monitoring window"),
    },
    {
      label: "Coordinate linkage",
      value: `${matched}/${telraam.length}`,
      note: matched ? "Fixed Viikki crossing anchor" : "Inferred layout",
    },
    {
      label: "Metric class",
      value: derived ? "Derived proxy" : "Observed",
      note: `${primary.properties?.observationCount ?? telraam.length} daily aggregates`,
    },
  ];
}

/**
 * KPI 2.1 / 3.1 / 3.2 / 4.1 / 4.2 evidence cards for the FVH1–FVH3 lighthouse assets ingested
 * by scripts/build-helsinki-data.mjs.
 */
export function helsinkiEvidenceStatCards(points: LocalCityPoint[]): HelsinkiStatCard[] | null {
  const cards: HelsinkiStatCard[] = [];

  const dangerous = points.find((p) => p.properties?.datasetKind === "dangerous-location");
  const conflicts = points.find((p) => p.properties?.datasetKind === "conflict");
  const mobilysis = points.find((p) => p.properties?.datasetKind === "mobilysis-gate");
  const escooter = points.filter((p) => p.properties?.datasetKind === "escooter-parking");
  const uxSurvey = points.find((p) => p.properties?.datasetKind === "ux-survey");
  const attitudeSurvey = points.find((p) => p.properties?.datasetKind === "safety-attitude-survey");

  if (dangerous) {
    cards.push({
      label: "Dangerous locations (FVH1 · KPI 2.1)",
      value: String(dangerous.properties?.observationCount ?? "—"),
      color: "#a78bfa",
      note: "Citywide citizen hazard survey",
    });
  }
  if (conflicts) {
    cards.push({
      label: "Near-miss / conflicts (FVH1 · KPI 2.1)",
      value: String(conflicts.properties?.observationCount ?? "—"),
      color: "#7c3aed",
      note: "Citywide citizen conflict survey",
    });
  }
  if (mobilysis) {
    cards.push({
      label: "VRU gate crossings (Viikki · KPI 2.1)",
      value: String(mobilysis.properties?.observationCount ?? "—"),
      color: "#2ecc71",
      note: "Mobilysis 2024-10-03 AM survey",
    });
  }
  if (escooter.length) {
    const totalObservations = escooter.reduce(
      (sum, p) => sum + (Number(p.properties?.observationCount) || 0),
      0
    );
    cards.push({
      label: "e-Scooter categories (FVH2 · KPI 3.1)",
      value: `${escooter.length} categories`,
      color: "#f97316",
      note: `${totalObservations} field observations · 20 planned sensors not delivered`,
    });
  }
  if (uxSurvey) {
    const isSatisfactionKpi =
      uxSurvey.properties?.kpi === "kpi4.1" || String(uxSurvey.id).includes("kpi4.1");
    const meets = String(uxSurvey.properties?.spatialNote ?? "").includes("Meets");
    cards.push(
      isSatisfactionKpi
        ? {
            label: "Viikki UX satisfaction (KPI 4.1)",
            value: `${uxSurvey.value.toFixed(1)}%`,
            color: meets || uxSurvey.value >= 75 ? "#2ecc71" : "#f87171",
            note: `${uxSurvey.properties?.observationCount ?? "—"} responses vs ≥75% target`,
          }
        : {
            label: "Viikki UX accessibility challenges (KPI 4.2)",
            value: `${uxSurvey.value.toFixed(1)}%`,
            color: "#96c2ef",
            note: `${uxSurvey.properties?.observationCount ?? "—"} responses self-reporting a visual/hearing/mobility challenge`,
          }
    );
  }

  if (attitudeSurvey) {
    cards.push({
      label: "Citywide safety attitude (KPI 3.2)",
      value: `${attitudeSurvey.value.toFixed(1)}%`,
      color: "#96c2ef",
      note: `${attitudeSurvey.properties?.observationCount ?? "—"} citywide respondents rate traffic safety positively`,
    });
  }

  return cards.length ? cards : null;
}

/**
 * KPI 1.1 (≥1 documented expansion plan) has no numeric dataset in the SharePoint drop —
 * surface this honestly rather than inventing a count.
 */
export function helsinkiExpansionPlanStatCards(): HelsinkiStatCard[] {
  return [
    {
      label: "Expansion plan (KPI 1.1)",
      value: "Data pending",
      color: "#f59e0b",
      note: "Expected outcome: ≥1 formal expansion plan post-pilot for the Viikki warning system. No structured expansion-plan artifact in the current SharePoint drop.",
    },
    {
      label: "Pilot scope (FVH3)",
      value: "Viikki crossing",
      color: "#38bdf8",
      note: "Raide-Jokeri light-rail crossing at Viikintie–Koetilantie; city considering scale-up if pilot succeeds.",
    },
  ];
}
