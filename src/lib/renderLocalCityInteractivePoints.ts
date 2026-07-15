import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import { addNeonPointMarker } from "@/lib/mapPointIcons";
import { resolveMapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import { spreadOverlappingPositions } from "@/lib/copenhagenMarkerLayout";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";

export interface RenderLocalCityInteractivePointsOptions {
  map: L.Map;
  cityName: string;
  selectedKpi: string;
  points: LocalCityPoint[];
  filterRange: [number, number];
  segmentHandlers?: SegmentInteractionHandlers;
  segmentInteractionEnabled?: boolean;
  selectedSegmentId?: string | null;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
  /** Disable coordinate fan-out (e.g. Telraam sensors already unique). */
  spreadOverlaps?: boolean;
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
  valueLabel: string
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
      <p style="font-size:10px;color:#2F1B6D;margin:0 0 3px 0;font-weight:700;">Data Quality</p>
      <div style="margin-bottom:4px;">
        ${badge(props.spatialQuality === "inferred" ? "Inferred" : "Exact")}
        ${badge(String(props.type || "observed"))}
        ${badge("Point-level")}
      </div>
      <p style="font-size:11px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${dataType}</p>
      <p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0 0 4px 0;">${point.value.toFixed(1)}${valueLabel}</p>
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
    segmentHandlers,
    segmentInteractionEnabled = false,
    selectedSegmentId,
    markersOut,
    circlesOut,
    spreadOverlaps = true,
    getValueColor,
  } = options;

  const filtered = points.filter(
    (p) => p.value >= filterRange[0] && p.value <= filterRange[1]
  );
  if (!filtered.length) return 0;

  const valueLabel =
    selectedKpi === "kpi1.2" || selectedKpi === "kpi4.2"
      ? "%"
      : selectedKpi === "kpi3.2"
        ? ""
        : "%";
  const allValues = filtered.map((p) => p.value);
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const span = Math.max(1, maxV - minV);

  const spreadMap = spreadOverlaps
    ? spreadOverlappingPositions(
        filtered.map((p) => ({
          id: String(p.properties?.id ?? p.id),
          lat: p.lat,
          lon: p.lon,
        })),
        map.getZoom(),
        { zoomStable: true }
      )
    : new Map(filtered.map((p) => [String(p.properties?.id ?? p.id), [p.lat, p.lon] as [number, number]]));

  let rendered = 0;
  for (const point of filtered) {
    const props = point.properties ?? {};
    const pointId = String(props.id ?? point.id);
    const spread = spreadMap.get(pointId);
    const lat = spread?.[0] ?? point.lat;
    const lon = spread?.[1] ?? point.lon;
    const normalizedValue = (point.value - minV) / span;
    const iconSpec = resolveMapPointIconSpec({
      facilityCategory: props.facilityCategory ?? props.category,
      category: props.category,
      datasetKind: props.datasetKind,
      type: props.type,
      kind: props.kind,
    });
    const valueColor =
      selectedKpi === "kpi1.2" || selectedKpi === "kpi4.2" || selectedKpi === "kpi3.2"
        ? getValueColor(point.value, false)
        : undefined;
    const segId = String(props.segmentId ?? point.id);
    const segName = `${iconSpec.label} · ${String(props.streetName ?? props.siteId ?? "Site")}`;
    const popupContent = popupForPoint(cityName, selectedKpi, point, iconSpec.label, valueLabel);
    const hitRadius = Math.max(10, Math.min(18, 9 + normalizedValue * 9));

    const { visual, hit } = addNeonPointMarker(
      map,
      lat,
      lon,
      iconSpec,
      {
        segmentId: segId,
        segmentName: segName,
        speed: null,
        congestion: point.value / 100,
        properties: props,
      },
      segmentInteractionEnabled ? segmentHandlers : undefined,
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
    void getValueColor;
    markersOut.push(visual);
    circlesOut.push(hit);
    rendered += 1;
  }

  scheduleLeafletLayerRepaint(map, markersOut);
  return rendered;
}
