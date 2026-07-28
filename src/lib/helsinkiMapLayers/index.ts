import type L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import type { MapScenario } from "@/lib/mapScenarioValue";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import type { wireCircleMarkerSegment } from "@/lib/wireMapSegmentInteraction";
import type {
  HelsinkiHslTram15Sample,
  HelsinkiInnotrafikAlarmSummary,
} from "@/lib/helsinkiDataPaths";
import { renderHelsinkiInterventionUnderlay } from "@/lib/helsinkiMapLayers/renderHelsinkiInterventionUnderlay";
import { renderHelsinkiHslTramLayer } from "@/lib/helsinkiMapLayers/renderHelsinkiHslTramLayer";
import { renderHelsinkiInnotrafikLayer } from "@/lib/helsinkiMapLayers/renderHelsinkiInnotrafikLayer";
import { renderHelsinkiKpi11Layers } from "@/lib/helsinkiMapLayers/renderHelsinkiKpi11Layers";
import { renderHelsinkiKpi12Layers } from "@/lib/helsinkiMapLayers/renderHelsinkiKpi12Layers";
import { renderHelsinkiKpi21Layers } from "@/lib/helsinkiMapLayers/renderHelsinkiKpi21Layers";
import { renderHelsinkiKpi32Layers } from "@/lib/helsinkiMapLayers/renderHelsinkiKpi32Layers";
import { renderHelsinkiEscooterLayer } from "@/lib/helsinkiMapLayers/renderHelsinkiEscooterLayer";
import { renderHelsinkiUxSurveyLayer } from "@/lib/helsinkiMapLayers/renderHelsinkiUxSurveyLayer";

export interface RenderHelsinkiMapLayersOptions {
  map: L.Map;
  selectedKpi: string;
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  scenario?: MapScenario;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  localCityPoints?: LocalCityPoint[];
  filterRange?: [number, number];
  getValueColor?: (value: number, inverted?: boolean) => string;
  wireCircleMarker?: typeof wireCircleMarkerSegment;
  circlesOut: L.CircleMarker[];
  polygonsOut: L.Polygon[];
  polylinesOut: L.Polyline[];
  markersOut: L.Marker[];
  /** Influence circles share the same ref as circlesOut in HeroMap. */
  circlesInfluenceOut?: L.Circle[];
  /** Optional prefetch from useHelsinkiHslTram / useHelsinkiInnotrafikSummary. */
  hslTramSample?: HelsinkiHslTram15Sample | null;
  innotrafikSummary?: HelsinkiInnotrafikAlarmSummary | null;
  showInterventionLayer?: boolean;
}

async function renderHelsinkiViikkiContextLayers(
  options: RenderHelsinkiMapLayersOptions,
  opts: { tramSubtle?: boolean; innotrafik?: boolean }
): Promise<void> {
  const pilot = options.selectedPilotId;
  if (pilot && pilot !== "hel-p3") return;

  await renderHelsinkiHslTramLayer({
    map: options.map,
    tramSample: options.hslTramSample,
    selectedPilotId: pilot,
    polylinesOut: options.polylinesOut,
    subtle: opts.tramSubtle,
    clipNearViikki: true,
    segmentInteractionEnabled: options.segmentInteractionEnabled,
    segmentHandlers: options.segmentHandlers,
    activeMapSegmentId: options.activeMapSegmentId,
  });

  if (opts.innotrafik) {
    await renderHelsinkiInnotrafikLayer({
      map: options.map,
      summary: options.innotrafikSummary,
      selectedPilotId: pilot,
      activeMapSegmentId: options.activeMapSegmentId,
      segmentInteractionEnabled: options.segmentInteractionEnabled,
      segmentHandlers: options.segmentHandlers,
      circlesOut: options.circlesOut,
    });
  }
}

/** Unified Helsinki KPI map dispatch (HeroMap early-return path). */
export async function renderHelsinkiMapLayers(
  options: RenderHelsinkiMapLayersOptions
): Promise<boolean> {
  const {
    map,
    selectedKpi: rawKpi,
    selectedPilotId,
    activeMapSegmentId,
    scenario = "baseline",
    segmentInteractionEnabled,
    segmentHandlers,
    localCityPoints = [],
    filterRange = [0, 100],
    getValueColor = () => "#38bdf8",
    wireCircleMarker,
    circlesOut,
    polygonsOut,
    polylinesOut,
    markersOut,
    circlesInfluenceOut,
    showInterventionLayer = false,
  } = options;

  // Ensure wheel zoom works — inferred-linkage previously locked Helsinki at maxZoom 12.
  if (typeof map.setMaxZoom === "function") map.setMaxZoom(18);
  if (typeof map.setMinZoom === "function") map.setMinZoom(4);

  const wire = wireCircleMarker;
  const pilotId = selectedPilotId ?? "hel-p1";

  // Route unsupported KPI tabs to the pilot's primary map layer (avoid single Viikki marker on FVH1).
  let selectedKpi = rawKpi;
  if (pilotId === "hel-p1") {
    if (rawKpi === "kpi1.1" || rawKpi === "kpi3.1" || rawKpi === "kpi4.1" || rawKpi === "kpi4.2") {
      selectedKpi = "kpi2.1";
    }
  } else if (pilotId === "hel-p2") {
    if (rawKpi === "kpi1.1" || rawKpi === "kpi2.1" || rawKpi === "kpi4.1") {
      selectedKpi = "kpi3.1";
    }
  } else if (pilotId === "hel-p3") {
    if (rawKpi === "kpi3.1" || rawKpi === "kpi3.2") {
      selectedKpi = "kpi1.2";
    }
  }

  switch (selectedKpi) {
    case "kpi1.1":
      await renderHelsinkiInterventionUnderlay({
        map,
        selectedPilotId,
        selectedKpi,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
        polygonsOut,
        circlesOut,
        circlesInfluenceOut,
        showSitePolygon: false,
      });
      await renderHelsinkiViikkiContextLayers(options, { tramSubtle: true, innotrafik: false });
      await renderHelsinkiKpi11Layers({
        map,
        scenario,
        selectedPilotId,
        activeMapSegmentId,
        segmentInteractionEnabled,
        segmentHandlers,
        circlesOut,
        markersOut,
        circlesInfluenceOut,
      });
      return true;

    case "kpi1.2":
      await renderHelsinkiInterventionUnderlay({
        map,
        selectedPilotId,
        selectedKpi,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
        polygonsOut,
        circlesOut,
        circlesInfluenceOut,
        showSitePolygon: false,
      });
      if (pilotId === "hel-p3") {
        await renderHelsinkiViikkiContextLayers(options, { tramSubtle: true, innotrafik: false });
      }
      if (wire) {
        await renderHelsinkiKpi12Layers({
          map,
          selectedPilotId,
          activeMapSegmentId,
          scenario,
          segmentInteractionEnabled,
          segmentHandlers,
          getValueColor,
          circlesOut,
          polygonsOut,
          polylinesOut,
          markersOut,
          wireCircleMarker: wire,
        });
      }
      return true;

    case "kpi2.1":
      await renderHelsinkiInterventionUnderlay({
        map,
        selectedPilotId,
        selectedKpi,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
        polygonsOut,
        circlesOut,
        circlesInfluenceOut,
        showSitePolygon: false,
      });
      // FVH3: tram/Innotrafik as monitoring context only — not survey points.
      if (pilotId === "hel-p3") {
        await renderHelsinkiViikkiContextLayers(options, { tramSubtle: true, innotrafik: true });
      } else {
        await renderHelsinkiViikkiContextLayers(options, { tramSubtle: false, innotrafik: true });
      }
      if (wire) {
        await renderHelsinkiKpi21Layers({
          map,
          localCityPoints,
          filterRange,
          scenario,
          selectedPilotId,
          activeMapSegmentId,
          segmentInteractionEnabled,
          segmentHandlers,
          circlesOut,
          polygonsOut,
          markersOut,
          getValueColor,
          wireCircleMarker: wire,
        });
      }
      return true;

    case "kpi3.2":
      await renderHelsinkiInterventionUnderlay({
        map,
        selectedPilotId,
        selectedKpi,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
        polygonsOut,
        circlesOut,
        circlesInfluenceOut,
      });
      await renderHelsinkiKpi32Layers({
        map,
        scenario,
        selectedPilotId,
        activeMapSegmentId,
        segmentInteractionEnabled,
        segmentHandlers,
        circlesOut,
        markersOut,
      });
      return true;

    case "kpi3.1":
      await renderHelsinkiInterventionUnderlay({
        map,
        selectedPilotId,
        selectedKpi,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
        polygonsOut,
        circlesOut,
        circlesInfluenceOut,
        showSitePolygon: false,
      });
      await renderHelsinkiEscooterLayer({
        map,
        selectedPilotId,
        maxPoints: 70,
        scenario,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
        circlesOut,
        markersOut,
        circlesInfluenceOut,
      });
      return true;

    case "kpi4.1":
    case "kpi4.2": {
      const isKallioAccessibility = selectedKpi === "kpi4.2" && selectedPilotId === "hel-p2";
      await renderHelsinkiInterventionUnderlay({
        map,
        selectedPilotId,
        selectedKpi,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
        polygonsOut,
        circlesOut,
        circlesInfluenceOut,
        showSitePolygon: false,
      });
      // FVH2 Kallio: parking observations only — never Viikki UX hub / tram "sensors".
      if (isKallioAccessibility) {
        await renderHelsinkiEscooterLayer({
          map,
          emphasizeAccessibility: false,
          flaggedOnly: false,
          maxPoints: 70,
          scenario,
          selectedPilotId,
          segmentInteractionEnabled,
          segmentHandlers,
          activeMapSegmentId,
          circlesOut,
          markersOut,
        });
        return true;
      }
      await renderHelsinkiViikkiContextLayers(options, { tramSubtle: true, innotrafik: false });
      await renderHelsinkiUxSurveyLayer({
        map,
        scenario,
        selectedPilotId,
        segmentInteractionEnabled,
        segmentHandlers,
        circlesOut,
        markersOut,
        circlesInfluenceOut,
        fitMap: true,
      });
      return true;
    }

    default:
      return false;
  }
}

export {
  renderHelsinkiKpi11Layers,
  renderHelsinkiKpi12Layers,
  renderHelsinkiKpi21Layers,
  renderHelsinkiKpi32Layers,
  renderHelsinkiEscooterLayer,
  renderHelsinkiUxSurveyLayer,
  renderHelsinkiHslTramLayer,
  renderHelsinkiInnotrafikLayer,
  renderHelsinkiInterventionUnderlay,
};
