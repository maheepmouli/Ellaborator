import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import { addNeonPointMarker } from "@/lib/mapPointIcons";
import { resolveMapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import { spreadOverlappingPositions } from "@/lib/copenhagenMarkerLayout";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import { milanHubSegmentId } from "@/lib/milanMapLayers/milanFlowGeometry";
import {
  kpiMetricKind,
  mapScenarioDisplayValue,
  type MapScenario,
} from "@/lib/mapScenarioValue";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";
import { getQuantile, getSegmentHighlight } from "@/lib/segmentHighlight";

/** Satisfaction / survey score → readable before/after colour (not one flat sky-blue band). */
export function satisfactionScoreColor(scorePct: number): string {
  if (!Number.isFinite(scorePct)) return "#38bdf8";
  if (scorePct >= 80) return "#10B981";
  if (scorePct >= 70) return "#34D399";
  // Split 60–70 so baseline (~62) vs intervention (~64) are not the same sky-blue.
  if (scorePct >= 64) return "#2DD4BF";
  if (scorePct >= 60) return "#38BDF8";
  if (scorePct >= 55) return "#60A5FA";
  if (scorePct >= 50) return "#A78BFA";
  if (scorePct >= 40) return "#FBBF24";
  return "#F87171";
}

/** Comparison delta (pp) for satisfaction pins. */
export function satisfactionDeltaColor(deltaPp: number): string {
  if (!Number.isFinite(deltaPp)) return "#94a3b8";
  if (deltaPp >= 2) return "#10B981";
  if (deltaPp > 0) return "#34D399";
  if (deltaPp === 0) return "#94a3b8";
  if (deltaPp > -2) return "#FBBF24";
  return "#F87171";
}

/** Milan KPI 4.2 DSS barrier categories — must match mapLayerLegend swatches. */
export function milanAccessibilityCategoryColor(
  category: unknown,
  score?: number
): string | null {
  const t = String(category ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (t.includes("equal") || t.includes("pari")) return "#22c55e";
  if (t.includes("slight") || t.includes("legger")) return "#fbbf24";
  if (t.includes("heavy") || t.includes("grav")) return "#f87171";
  // Score fallback when category label is missing / illustrative.
  if (typeof score === "number" && Number.isFinite(score)) {
    if (score >= 75) return "#22c55e";
    if (score >= 55) return "#fbbf24";
    return "#f87171";
  }
  return null;
}

/** Stable click id shared with Milan observatory segment list. */
function resolveInteractivePointSegmentId(
  cityName: string,
  point: LocalCityPoint
): string {
  const props = (point.properties ?? {}) as Record<string, unknown>;
  if (cityName === "Milan") {
    const junctionId = String(props.junctionId ?? "");
    const siteKey = String(props.siteKey ?? "");
    if (junctionId.startsWith("mil-junction-") || siteKey.startsWith("mil-junction-")) {
      return milanHubSegmentId(props);
    }
  }
  return String(props.segmentId ?? props.id ?? point.id);
}

export interface RenderLocalCityInteractivePointsOptions {
  map: L.Map;
  cityName: string;
  selectedKpi: string;
  points: LocalCityPoint[];
  filterRange: [number, number];
  scenario?: MapScenario;
  segmentHandlers?: SegmentInteractionHandlers;
  segmentInteractionEnabled?: boolean;
  selectedSegmentId?: string | null;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
  /** Disable coordinate fan-out (e.g. Telraam sensors already unique). */
  spreadOverlaps?: boolean;
  /** Prefer plain filled circles (pressure colour readable) over neon taxonomy badges. */
  markerStyle?: "neon" | "filled";
  getValueColor: (value: number, inverted?: boolean) => string;
}

function badge(label: string): string {
  return `<span style="display:inline-block;padding:2px 6px;margin:2px 2px 0 0;border-radius:4px;font-size:8px;font-weight:700;background:rgba(101,125,245,0.15);color:#2F1B6D;">${label}</span>`;
}

function popupForPoint(
  cityName: string,
  selectedKpi: string,
  point: LocalCityPoint,
  iconLabel: string,
  valueLabel: string,
  displayValue: number,
  scenario: MapScenario
): string {
  const props = point.properties ?? {};
  const dataType =
    selectedKpi === "kpi1.2"
      ? "Mobility count"
      : selectedKpi === "kpi4.2"
        ? "Accessibility"
        : selectedKpi === "kpi3.2"
          ? "Climate proxy"
          : selectedKpi === "kpi2.1"
            ? "Safety proxy"
            : "Sensor";
  const baselineNum =
    typeof props.baselineValue === "number" ? (props.baselineValue as number) : undefined;
  const interventionNum =
    typeof props.interventionValue === "number" ? (props.interventionValue as number) : undefined;
  const deltaNum =
    typeof props.comparisonValue === "number"
      ? (props.comparisonValue as number)
      : interventionNum !== undefined && baselineNum !== undefined
        ? interventionNum - baselineNum
        : undefined;

  return `
    <div style="font-family:'DM Sans',sans-serif;padding:6px;min-width:150px;">
      <p style="font-size:10px;color:#2F1B6D;margin:0 0 3px 0;font-weight:700;">Data Quality · ${scenario}</p>
      <div style="margin-bottom:4px;">
        ${badge(props.spatialQuality === "inferred" ? "Inferred" : "Exact")}
        ${badge(String(props.type || "observed"))}
        ${badge("Point-level")}
      </div>
      <p style="font-size:11px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${dataType}</p>
      <p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0 0 4px 0;">${displayValue.toFixed(1)}${valueLabel}</p>
      <p style="font-size:10px;color:#96C2EF;margin:0 0 2px 0;">${String(props.streetName ?? props.siteId ?? iconLabel)}</p>
      ${baselineNum !== undefined ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Baseline: ${baselineNum.toFixed(1)}${valueLabel}</p>` : ""}
      ${interventionNum !== undefined ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Intervention: ${interventionNum.toFixed(1)}${valueLabel}</p>` : ""}
      ${deltaNum !== undefined ? `<p style="font-size:10px;font-weight:700;color:${deltaNum >= 0 ? "#22C55E" : "#A78BFA"};margin:2px 0;">Δ ${deltaNum >= 0 ? "+" : ""}${deltaNum.toFixed(1)}${valueLabel}</p>` : ""}
      <div style="border-top:1px solid rgba(101,125,245,0.2);padding-top:4px;margin-top:4px;">
        <p style="font-size:9px;color:#96C2EF;margin:0;">${String(props.source || "Local dataset (SharePoint)")}</p>
        ${props.spatialNote ? `<p style="font-size:9px;color:#96C2EF;margin:2px 0 0 0;">${String(props.spatialNote)}</p>` : ""}
        <p style="font-size:9px;color:#96C2EF;margin:2px 0 0 0;">City: ${cityName}</p>
      </div>
    </div>
  `;
}

/** Copenhagen/Trikala-style divIcon markers with reliable hover targets for local city datasets. */
export function renderLocalCityInteractivePoints(
  options: RenderLocalCityInteractivePointsOptions
): number {
  const {
    map,
    cityName,
    selectedKpi,
    points,
    filterRange,
    scenario = "intervention",
    segmentHandlers,
    segmentInteractionEnabled = false,
    selectedSegmentId,
    markersOut,
    circlesOut,
    spreadOverlaps = true,
    markerStyle = "neon",
    getValueColor,
  } = options;

  const kind = kpiMetricKind(selectedKpi);
  const withDisplay = points.map((p) => {
    const props = p.properties ?? {};
    const baseline = Number(props.baselineValue ?? p.value ?? 0);
    const intervention = Number(props.interventionValue ?? p.value ?? 0);
    const comparison =
      typeof props.comparisonValue === "number"
        ? Number(props.comparisonValue)
        : intervention - baseline;
    const displayValue = mapScenarioDisplayValue(scenario, baseline, intervention, {
      comparison,
      kind,
    });
    return { point: p, displayValue };
  });

  const filtered = withDisplay.filter(
    (row) => row.displayValue >= filterRange[0] && row.displayValue <= filterRange[1]
  );
  if (!filtered.length) return 0;

  const valueLabel =
    selectedKpi === "kpi1.2" || selectedKpi === "kpi4.2" || selectedKpi === "kpi4.1"
      ? "%"
      : selectedKpi === "kpi3.1"
        ? " units"
      : selectedKpi === "kpi3.2"
        ? ""
        : "%";
  const allValues = filtered.map((row) => row.displayValue);
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  // Satisfaction scores often sit in a tight band (e.g. 62–64) — use absolute 0–100
  // so radius/colour still change between baseline and intervention.
  const satisfactionAbsolute = selectedKpi === "kpi4.1";
  const span = satisfactionAbsolute ? 100 : Math.max(1, maxV - minV);

  const spreadMap = spreadOverlaps
    ? spreadOverlappingPositions(
        filtered.map(({ point: p }) => ({
          id: String(p.properties?.id ?? p.id),
          lat: p.lat,
          lon: p.lon,
        })),
        map.getZoom(),
        { zoomStable: true }
      )
    : new Map(
        filtered.map(({ point: p }) => [
          String(p.properties?.id ?? p.id),
          [p.lat, p.lon] as [number, number],
        ])
      );

  const interactionOn = Boolean(segmentHandlers);

  let rendered = 0;
  for (const { point, displayValue } of filtered) {
    const props = point.properties ?? {};
    const pointId = String(props.id ?? point.id);
    const spread = spreadMap.get(pointId);
    const lat = spread?.[0] ?? point.lat;
    const lon = spread?.[1] ?? point.lon;
    const normalizedValue = satisfactionAbsolute
      ? Math.max(0, Math.min(1, displayValue / 100))
      : (displayValue - minV) / span;
    const iconSpec = resolveMapPointIconSpec({
      facilityCategory: props.facilityCategory ?? props.category,
      category: props.category,
      datasetKind: props.datasetKind,
      type: props.type,
      kind: props.kind,
    });
    const valueColor =
      selectedKpi === "kpi1.2" ||
      selectedKpi === "kpi4.1" ||
      selectedKpi === "kpi4.2" ||
      selectedKpi === "kpi3.2" ||
      selectedKpi === "kpi2.1"
        ? selectedKpi === "kpi4.1"
          ? scenario === "comparison"
            ? satisfactionDeltaColor(displayValue)
            : satisfactionScoreColor(displayValue)
          : getValueColor(displayValue, selectedKpi === "kpi2.1")
        : undefined;
    const segId = resolveInteractivePointSegmentId(cityName, point);
    const segName = `${iconSpec.label} · ${String(
      props.junctionLabel ?? props.streetName ?? props.siteId ?? props.category ?? "Site"
    )}`;
    const popupContent = popupForPoint(
      cityName,
      selectedKpi,
      point,
      iconSpec.label,
      valueLabel,
      displayValue,
      scenario
    );
    const hitRadius = Math.max(16, Math.min(26, 14 + normalizedValue * 10));
    const detail = {
      segmentId: segId,
      segmentName: segName,
      // Accessibility is barrier category — never invent traficissy speed/congestion.
      speed: null as number | null,
      congestion: selectedKpi === "kpi4.2" ? null : displayValue / 100,
      properties: props,
    };
    const handlers =
      interactionOn || segmentInteractionEnabled ? segmentHandlers : undefined;

    if (markerStyle === "filled") {
      const climateColor =
        selectedKpi === "kpi3.2"
          ? getSegmentHighlight(
              displayValue,
              getQuantile(allValues, 0.15),
              getQuantile(allValues, 0.85),
              "climate"
            ).color
          : null;
      const a11yColor =
        selectedKpi === "kpi4.2"
          ? milanAccessibilityCategoryColor(
              props.category ?? props.facilityCategory ?? props.likertLabel,
              displayValue
            )
          : null;
      const fillColor = climateColor ?? a11yColor ?? valueColor ?? "#38bdf8";
      // Satisfaction: larger dots + score chip so before/after is obvious when toggling scenario.
      const radius =
        selectedKpi === "kpi4.1"
          ? Math.max(8, Math.min(14, 7 + normalizedValue * 7))
          : Math.max(6, Math.min(11, 6 + normalizedValue * 4));
      const circle = L.circleMarker([lat, lon], {
        radius,
        color: selectedKpi === "kpi4.1" ? "#ffffff" : "#0b1220",
        weight: selectedKpi === "kpi4.1" ? 2 : 1.25,
        fillColor,
        fillOpacity: 0.92,
        opacity: 0.95,
        interactive: Boolean(handlers),
      }).addTo(map);
      if (popupContent) circle.bindPopup(popupContent);
      if (segName) {
        const tip =
          selectedKpi === "kpi4.1"
            ? `${segName} · ${
                scenario === "comparison"
                  ? `${displayValue >= 0 ? "+" : ""}${displayValue.toFixed(1)} pp`
                  : `${displayValue.toFixed(0)}%`
              }`
            : segName;
        circle.bindTooltip(tip, { sticky: true, direction: "top", opacity: 0.95 });
      }
      if (handlers) {
        wireCircleMarkerSegment(circle, detail, handlers, {
          selectedSegmentId,
          baseRadius: radius,
          baseStyle: {
            color: "#0b1220",
            weight: 1.25,
            fillColor,
            fillOpacity: 0.9,
            opacity: 0.95,
          },
        });
      }
      circlesOut.push(circle);
      rendered += 1;
      continue;
    }

    const { visual, hit } = addNeonPointMarker(
      map,
      lat,
      lon,
      iconSpec,
      detail,
      handlers,
      {
        title: segName,
        hitRadius,
        selectedSegmentId,
        popupHtml: popupContent,
        tooltip: segName,
        accent: valueColor,
        glow: valueColor,
      }
    );
    markersOut.push(visual);
    circlesOut.push(hit);
    rendered += 1;
  }

  scheduleLeafletLayerRepaint(map, markersOut);
  return rendered;
}
