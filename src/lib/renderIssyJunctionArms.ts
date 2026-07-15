import L from "leaflet";
import type { MapSegment } from "@/services/trafficApi";
import {
  getIssyJunctionArm,
  ISSY_JUNCTION_ARMS,
  ISSY_P2_JUNCTION,
  junctionMarkerLatLng,
} from "@/lib/issyPilot2Junction";
import {
  applyJunctionHighlightVisibility,
  getQuantile,
  getSegmentHighlight,
  segmentMetricKindForKpi,
} from "@/lib/segmentHighlight";
import { trimSegmentApproachFromJunction } from "@/lib/junctionArmRendering";
import { createJunctionSampleDotIcon } from "@/lib/junctionSampleMarkers";
import { junctionArmSeed } from "@/lib/junctionScenarioValues";
import { issyModeColor } from "@/lib/issyMapRouting";
import {
  BASELINE_GHOST_COLOR,
  COMPARISON_FAVOURABLE_COLOR,
  COMPARISON_OTHER_COLOR,
  comparisonLineWeight,
  getJunctionScenarioMetrics,
  isJunctionComparisonFavourable,
  type MapScenario,
} from "@/lib/junctionScenarioValues";
import {
  dataSourceTrustLabel,
  junctionArmMetricTitle,
  junctionArmValueCaption,
  kpiPrimaryIssySource,
} from "@/lib/issyDataTransparency";
import { provenanceBadgesHtml } from "@/lib/dataProvenance";
import {
  wireMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";
import { renderHubRipplePulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";

export type JunctionObservatoryClick = (detail: {
  segmentId: string;
  segmentName: string;
  speed: number | null;
  congestion: number | null;
}) => void;

export type IssyJunctionLayerRefs = {
  circles: Array<L.CircleMarker | L.Circle>;
  markers: L.Marker[];
  polylines: L.Polyline[];
};

export function pickNearestJunctionSegmentId(lat: number, lon: number): string {
  let bestId = ISSY_JUNCTION_ARMS[0].segmentId;
  let bestScore = -Infinity;
  for (const arm of ISSY_JUNCTION_ARMS) {
    const score =
      arm.id === "west"
        ? -lon
        : arm.id === "east"
          ? lon
          : arm.id === "north"
            ? lat
            : -lat;
    if (score > bestScore) {
      bestScore = score;
      bestId = arm.segmentId;
    }
  }
  return bestId;
}

function segmentProps(segment: MapSegment) {
  return (segment.properties || {}) as Record<string, unknown>;
}

/**
 * Renders a single monitored intervention corridor with low-opacity contextual streets.
 * Used for KPI 2.1 / 1.2 / 3.2 contextual traficissy segment monitoring.
 */
export function renderIssyJunctionArms(
  map: L.Map,
  roadSegments: MapSegment[],
  selectedKpi: string,
  refs: IssyJunctionLayerRefs,
  options: {
    onObservatoryClick: JunctionObservatoryClick;
    selectedSegmentId?: string | null;
    /** KPI 1.2: tint lines by active travel mode colour (intervention / baseline only). */
    modeAccent?: string;
    scenario?: MapScenario;
    onSegmentHover?: (detail: {
      segmentId: string;
      segmentName: string;
      speed?: number | null;
      congestion?: number | null;
    } | null) => void;
    filterRange?: [number, number];
    segmentHandlers?: SegmentInteractionHandlers;
  }
): void {
  const scenario = options.scenario ?? "intervention";
  const segmentMetric = segmentMetricKindForKpi(selectedKpi);
  const metricsById = new Map(
    roadSegments.map((s) => [s.id, getJunctionScenarioMetrics(s, selectedKpi)])
  );
  const displayValues = roadSegments.map((s) => {
    const m = metricsById.get(s.id)!;
    if (scenario === "baseline") return m.baseline;
    if (scenario === "intervention") return m.intervention;
    return m.absDelta;
  });
  const lowThreshold = displayValues.length > 1 ? getQuantile(displayValues, 0.15) : 0;
  const highThreshold = displayValues.length > 1 ? getQuantile(displayValues, 0.85) : 100;

  const openObservatory = (segment: MapSegment, segmentLabel: string) => {
    const props = segmentProps(segment);
    options.onObservatoryClick({
      segmentId: segment.id,
      segmentName: segmentLabel,
      speed: (props.vitesse_km_h as number | undefined) ?? null,
      congestion: (props.indice_de_congestion as number | undefined) ?? null,
    });
  };

  const range = options.filterRange ?? [0, 100];
  const displayScalars = roadSegments.map((segment) => {
    const metrics = metricsById.get(segment.id);
    if (!metrics) return 0;
    if (scenario === "baseline") return metrics.baseline;
    if (scenario === "intervention") return metrics.intervention;
    return metrics.absDelta;
  });
  const minScalar = Math.min(...displayScalars, 0);
  const maxScalar = Math.max(...displayScalars, 1);
  const span = Math.max(maxScalar - minScalar, 1e-6);
  const rangeLowVal = minScalar + (span * range[0]) / 100;
  const rangeHighVal = minScalar + (span * range[1]) / 100;

  roadSegments.forEach((segment) => {
    if (!segment.coordinates || segment.coordinates.length < 2) return;

    const arm = getIssyJunctionArm(segment.id);
    const props = segmentProps(segment);
    const segmentLabel =
      arm?.mapLabel ?? (props.segment as string | undefined) ?? segment.id;
    const approachCoords = arm
      ? trimSegmentApproachFromJunction(segment.coordinates, arm.id)
      : segment.coordinates;

    const metrics = metricsById.get(segment.id)!;
    const displayValue =
      scenario === "baseline"
        ? metrics.baseline
        : scenario === "intervention"
          ? metrics.intervention
          : metrics.absDelta;

    const isSelected = options.selectedSegmentId === segment.id;
    if (!isSelected && (displayValue < rangeLowVal || displayValue > rangeHighVal)) {
      return;
    }

    const highlight = applyJunctionHighlightVisibility(
      getSegmentHighlight(displayValue, lowThreshold, highThreshold, segmentMetric)
    );

    const favourable = isJunctionComparisonFavourable(metrics.delta, selectedKpi);
    const deltaColor = favourable ? COMPARISON_FAVOURABLE_COLOR : COMPARISON_OTHER_COLOR;

    const armAccent = arm?.color ?? highlight.color;
    let lineColor = armAccent;
    let lineWeight = Math.max(highlight.weight, 8.5);
    let lineOpacity = Math.max(highlight.opacity, 0.96);
    let dashArray: string | undefined;

    if (scenario === "comparison") {
      lineColor = deltaColor;
      lineWeight = Math.max(comparisonLineWeight(metrics.absDelta), 8);
      lineOpacity = Math.min(0.98, 0.72 + metrics.absDelta / 120);
    } else if (scenario === "baseline") {
      lineColor = "#cbd5e1";
      lineWeight = Math.max(6.5, highlight.weight - 0.5);
      lineOpacity = 0.82;
      dashArray = "7 5";
    } else if (selectedKpi === "kpi1.2" && options.modeAccent) {
      lineColor = options.modeAccent;
      lineWeight = Math.max(lineWeight, 8);
    } else {
      lineColor = highlight.color === "#7B8AB8" ? armAccent : highlight.color;
    }

    // Corridor-first model: non-selected streets are context only (always dimmed).
    const focusDim = isSelected ? 1 : options.selectedSegmentId ? 0.24 : 0.34;
    const lineStyle = {
      color: isSelected ? "#ffffff" : lineColor,
      weight: isSelected ? lineWeight + 5 : Math.max(3.8, lineWeight * 0.62),
      opacity: isSelected ? 1 : Math.min(0.98, lineOpacity * focusDim),
      dashArray,
      lineJoin: "round" as const,
      lineCap: "round" as const,
    };

    const scenarioLabel =
      scenario === "baseline"
        ? "Baseline (derived)"
        : scenario === "intervention"
          ? "Intervention (observed)"
          : "Change vs baseline";

    const speed = (props.vitesse_km_h as number | undefined) ?? null;
    const congestion = (props.indice_de_congestion as number | undefined) ?? null;
    const trustKind = kpiPrimaryIssySource(selectedKpi);
    const trustBadge = provenanceBadgesHtml([dataSourceTrustLabel(trustKind), "traficissy"]);
    const metricTitle = junctionArmMetricTitle(selectedKpi);

    const kpi12Note =
      selectedKpi === "kpi1.2"
        ? `<p style="font-size: 9px; color: #A78BFA; margin-top: 6px; line-height: 1.35;">Mode share comes from the OD CSV at zone level. The monitored intervention corridor shows traffic context from the traficissy segment API.</p>`
        : "";

    const popupContent = `
      <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 200px;">
        <div style="margin-bottom: 6px;">${trustBadge}</div>
        <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">${ISSY_P2_JUNCTION.shortName}</p>
        <p style="font-size: 10px; color: #96C2EF; margin: 0 0 4px 0; font-weight: 600;">${segmentLabel}</p>
        <p style="font-size: 10px; color: #A78BFA; margin: 0 0 4px 0; font-weight: 600;">${metricTitle}</p>
        <p style="font-size: 10px; color: #A78BFA; margin: 0 0 6px 0;">${scenarioLabel}</p>
        ${
          scenario === "comparison"
            ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Baseline: ${metrics.baseline.toFixed(1)}</p>
               <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Intervention: ${metrics.intervention.toFixed(1)}</p>
               <p style="font-size: 13px; font-weight: 700; color: ${deltaColor}; margin: 4px 0;">
                 Δ ${metrics.delta >= 0 ? "+" : ""}${metrics.delta.toFixed(1)} (${favourable ? "favourable" : "other"})
               </p>`
            : `<p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 4px 0;">${displayValue.toFixed(1)}</p>
               <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Band: ${highlight.band}</p>
               <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Baseline: ${metrics.baseline.toFixed(1)} · Post: ${metrics.intervention.toFixed(1)}</p>`
        }
        ${speed != null ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Speed: ${speed.toFixed(1)} km/h (observed)</p>` : ""}
        ${congestion != null ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Congestion index: ${congestion.toFixed(2)} (observed)</p>` : ""}
        <p style="font-size: 9px; color: #A78BFA; margin-top: 6px; line-height: 1.35;">${junctionArmValueCaption(selectedKpi)}</p>
        ${kpi12Note}
        <p style="font-size: 9px; color: #96C2EF; margin-top: 4px;">Monitored intervention corridor with observed traficissy context. Nearby streets are low-opacity context only.</p>
        <p style="font-size: 10px; color: #96C2EF; margin-top: 6px; font-weight: 600;">Click for observatory</p>
      </div>
    `;

    const onArmClick = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      map.closePopup();
      openObservatory(segment, segmentLabel);
    };

    if (scenario === "comparison") {
      const ghost = L.polyline(approachCoords, {
        color: BASELINE_GHOST_COLOR,
        weight: 4,
        opacity: 0.5,
        dashArray: "5 6",
        lineJoin: "round",
        lineCap: "round",
        interactive: false,
      }).addTo(map);
      refs.polylines.push(ghost);
    }

    const glowPass = L.polyline(approachCoords, {
      color: armAccent,
      weight: isSelected ? lineWeight + 10 : lineWeight + 7,
      opacity: isSelected ? 0.38 : 0.22,
      lineJoin: "round",
      lineCap: "round",
      interactive: false,
    }).addTo(map);
    const auraPass = L.polyline(approachCoords, {
      color: isSelected ? "#00ffff" : armAccent,
      weight: isSelected ? lineWeight + 5 : lineWeight + 3,
      opacity: isSelected ? 0.55 : 0.32,
      lineJoin: "round",
      lineCap: "round",
      interactive: false,
    }).addTo(map);

    const visibleLine = L.polyline(approachCoords, lineStyle).addTo(map);
    if (isSelected) {
      const halo = L.polyline(approachCoords, {
        color: armAccent,
        weight: lineStyle.weight + 6,
        opacity: 0.62,
        lineJoin: "round",
        lineCap: "round",
        interactive: false,
      }).addTo(map);
      refs.polylines.push(halo);
    }
    const hitLine = L.polyline(approachCoords, {
      color: "#000000",
      weight: 24,
      opacity: 0,
      lineJoin: "round",
      lineCap: "round",
    }).addTo(map);

    const sparklineSvg = (() => {
      const seed = junctionArmSeed(segment.id);
      const pts = Array.from({ length: 7 }, (_, i) => {
        const v = 50 + Math.sin(i * 0.9 + seed * 6) * 18 + (metrics.intervention - metrics.baseline) * 0.3;
        return Math.max(8, Math.min(92, v));
      });
      const coords = pts
        .map((v, i) => `${(i / 6) * 56},${24 - (v / 100) * 20}`)
        .join(" ");
      return `<svg width="56" height="24" style="margin-top:6px"><polyline points="${coords}" fill="none" stroke="${deltaColor}" stroke-width="2"/></svg>`;
    })();

    const popupWithSpark =
      scenario === "comparison"
        ? popupContent.replace("</div>", `${sparklineSvg}</div>`)
        : popupContent;

    visibleLine.bindPopup(popupWithSpark);
    hitLine.bindPopup(popupWithSpark);

    const wire = (layer: L.Polyline) => {
      layer.on("mouseover", () => {
        visibleLine.setStyle({ weight: lineStyle.weight + 2.5, opacity: 1 });
        glowPass.setStyle({ opacity: 0.45, weight: lineStyle.weight + 10 });
        const props = segmentProps(segment);
        const hoverDetail = {
          segmentId: segment.id,
          segmentName: segmentLabel,
          speed: (props.vitesse_km_h as number | undefined) ?? null,
          congestion: (props.indice_de_congestion as number | undefined) ?? null,
        };
        options.onSegmentHover?.(hoverDetail);
        options.segmentHandlers?.onSegmentHover?.(hoverDetail);
      });
      layer.on("mouseout", () => {
        visibleLine.setStyle(lineStyle);
        glowPass.setStyle({
          color: armAccent,
          weight: isSelected ? lineWeight + 10 : lineWeight + 7,
          opacity: isSelected ? 0.38 : 0.22,
        });
        options.onSegmentHover?.(null);
        options.segmentHandlers?.onSegmentHover?.(null);
      });
      layer.on("click", onArmClick);
    };
    wire(visibleLine);
    wire(hitLine);

    refs.polylines.push(glowPass, auraPass, visibleLine, hitLine);
  });

  const [markerLat, markerLng] = junctionMarkerLatLng(roadSegments);
  const selectedSeg = roadSegments.find((s) => s.id === options.selectedSegmentId);
  const selectedDisplay = selectedSeg
    ? (() => {
        const m = metricsById.get(selectedSeg.id)!;
        if (scenario === "baseline") return m.baseline;
        if (scenario === "intervention") return m.intervention;
        return m.absDelta;
      })()
    : displayValues[0] ?? 50;
  const markerHighlight = getSegmentHighlight(
    selectedDisplay,
    lowThreshold,
    highThreshold,
    segmentMetric
  );

  const junctionMarker = L.marker([markerLat, markerLng], {
    icon: createJunctionSampleDotIcon(
      applyJunctionHighlightVisibility(markerHighlight),
      "anchor"
    ),
    zIndexOffset: 900,
  }).addTo(map);

  const hubTarget =
    selectedSeg ?? roadSegments.find((s) => getIssyJunctionArm(s.id)) ?? roadSegments[0];
  const hubArm = hubTarget ? getIssyJunctionArm(hubTarget.id) : undefined;
  const hubDetail = {
    segmentId: hubTarget?.id ?? ISSY_JUNCTION_ARMS[0].segmentId,
    segmentName: `${ISSY_P2_JUNCTION.shortName} · Wintics camera`,
    speed: hubTarget ? ((segmentProps(hubTarget).vitesse_km_h as number | undefined) ?? null) : null,
    congestion: hubTarget
      ? ((segmentProps(hubTarget).indice_de_congestion as number | undefined) ?? null)
      : null,
  };

  if (options.segmentHandlers) {
    wireMarkerSegment(junctionMarker, hubDetail, options.segmentHandlers);
  }

  junctionMarker.on("click", (e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    map.closePopup();
    if (hubTarget) {
      openObservatory(
        hubTarget,
        hubArm?.mapLabel ?? (segmentProps(hubTarget).segment as string) ?? hubTarget.id
      );
    }
  });
  refs.markers.push(junctionMarker);
}

/** Attach observatory open to any junction layer (hex, POI, etc.). */
export function bindJunctionObservatoryLayer(
  layer: L.Layer,
  map: L.Map,
  roadSegments: MapSegment[],
  onObservatoryClick: JunctionObservatoryClick,
  lat: number,
  lon: number,
  segmentHandlers?: SegmentInteractionHandlers
): void {
  const resolveDetail = (): {
    segmentId: string;
    segmentName: string;
    speed: number | null;
    congestion: number | null;
  } | null => {
    const segmentId = pickNearestJunctionSegmentId(lat, lon);
    const segment = roadSegments.find((s) => s.id === segmentId) ?? roadSegments[0];
    if (!segment) return null;
    const arm = getIssyJunctionArm(segment.id);
    const props = segmentProps(segment);
    return {
      segmentId: segment.id,
      segmentName: arm?.mapLabel ?? String(props.segment ?? segment.id),
      speed: (props.vitesse_km_h as number | undefined) ?? null,
      congestion: (props.indice_de_congestion as number | undefined) ?? null,
    };
  };

  layer.on("mouseover", () => {
    const detail = resolveDetail();
    if (!detail) return;
    segmentHandlers?.onSegmentHover?.(detail);
    segmentHandlers?.onSegmentFocus?.({
      segmentName: detail.segmentName,
      speed: detail.speed,
      congestion: detail.congestion,
    });
  });
  layer.on("mouseout", () => {
    segmentHandlers?.onSegmentHover?.(null);
  });
  layer.on("click", (e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    map.closePopup();
    const detail = resolveDetail();
    if (!detail) return;
    onObservatoryClick(detail);
  });
}

/** Copenhagen-style ripple rings at the Issy junction camera hub. */
export function renderIssyJunctionHubPulse(
  map: L.Map,
  roadSegments: MapSegment[],
  refs: IssyJunctionLayerRefs
): void {
  let northSouth = 0;
  let eastWest = 0;
  roadSegments.forEach((segment) => {
    const arm = getIssyJunctionArm(segment.id);
    if (!arm) return;
    const congestion = Number(segmentProps(segment).indice_de_congestion ?? 0);
    if (arm.id === "north" || arm.id === "south") northSouth += congestion;
    else eastWest += congestion;
  });

  renderHubRipplePulseOverlay(
    map,
    ISSY_P2_JUNCTION.lat,
    ISSY_P2_JUNCTION.lon,
    northSouth >= eastWest,
    refs.markers,
    refs.circles as L.CircleMarker[],
    { showAnchorDot: false }
  );
}

export function resolveJunctionModeAccent(selectedModeTypes: string[]): string {
  if (!selectedModeTypes?.length) return issyModeColor("Cycle");
  const primary = selectedModeTypes[0];
  if (primary === "Pedestrian") return issyModeColor("Pedestrian");
  if (primary === "Cycle") return issyModeColor("Bicycle");
  if (primary === "Public Transport") return issyModeColor("Bus");
  if (primary === "Private Car") return issyModeColor("Car");
  if (primary === "PTW") return issyModeColor("Motorcycle");
  return issyModeColor(primary);
}
