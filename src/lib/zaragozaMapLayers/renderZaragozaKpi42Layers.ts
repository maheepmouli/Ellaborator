import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import { addNeonPointMarker } from "@/lib/mapPointIcons";
import { resolveMapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import type { MapScenario } from "@/context/MapIntelligenceContext";

export interface RenderZaragozaKpi42LayersOptions {
  map: L.Map;
  points: LocalCityPoint[];
  scenario?: MapScenario;
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
}

function featureStatus(p: LocalCityPoint): string {
  return String(
    p.properties?.featureStatus ?? p.properties?.status ?? "existing"
  ).toLowerCase();
}

/** Baseline: existing only (2). Intervention/comparison: existing + post (4). */
export function filterZaragozaAccessibilityForScenario(
  points: LocalCityPoint[],
  scenario: MapScenario = "intervention"
): LocalCityPoint[] {
  const a11y = points.filter((p) => String(p.properties?.datasetKind ?? "") === "accessibility");
  if (scenario === "baseline") {
    return a11y.filter((p) => {
      const status = featureStatus(p);
      return status === "existing" || status === "" || (!status.includes("post") && !status.includes("planned"));
    });
  }
  return a11y.filter((p) => {
    const status = featureStatus(p);
    return status !== "planned";
  });
}

/** Green accessibility (A) badges — same icon family as Trikala / Issy / Milan. */
export function renderZaragozaKpi42Layers(options: RenderZaragozaKpi42LayersOptions): number {
  const {
    map,
    points,
    scenario = "intervention",
    selectedPilotId,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    markersOut,
    circlesOut,
  } = options;

  const scoped = points.filter((p) => {
    const pid = String(p.properties?.pilotId ?? p.properties?.interventionId ?? "");
    return !selectedPilotId || !pid || pid === selectedPilotId;
  });
  const visible = filterZaragozaAccessibilityForScenario(
    scoped.length ? scoped : points,
    scenario
  );
  if (!visible.length) return 0;

  const iconSpec = resolveMapPointIconSpec({ facilityCategory: "accessibility" });

  visible.forEach((point) => {
    const props = point.properties ?? {};
    const segmentId = String(props.segmentId ?? point.id);
    const label = String(props.streetName ?? props.likertLabel ?? "Accessibility feature");
    const status = featureStatus(point);
    const baseline = Number(props.baselineValue ?? 0);
    const after = Number(props.interventionValue ?? point.value ?? 0);
    const selected = Boolean(activeMapSegmentId && activeMapSegmentId === segmentId);

    const { visual, hit } = addNeonPointMarker(
      map,
      point.lat,
      point.lon,
      iconSpec,
      {
        segmentId,
        segmentName: label,
        speed: null,
        congestion: null,
      },
      segmentInteractionEnabled ? segmentHandlers : undefined,
      {
        title: label,
        hitRadius: selected ? 16 : 14,
        zIndexOffset: selected ? 2400 : 2100,
        selectedSegmentId: activeMapSegmentId,
        tooltip: `${label} · ${status === "post-intervention" ? "post" : "baseline"}`,
        popupHtml: `
          <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:190px;">
            <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Zaragoza accessibility · KPI 4.2</p>
            <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${label}</p>
            <p style="font-size:11px;color:#16a34a;margin:0 0 4px 0;">${status.replace(/-/g, " ")}</p>
            <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Before ${baseline.toFixed(0)} → After ${after.toFixed(0)}</p>
            <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${String(props.source ?? "Mock a11y features")}</p>
          </div>
        `,
      }
    );
    markersOut.push(visual);
    circlesOut.push(hit);
  });

  scheduleLeafletLayerRepaint(map, markersOut, circlesOut);
  return visible.length;
}
