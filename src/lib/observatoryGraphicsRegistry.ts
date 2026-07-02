import type { KPIFrameworkId } from "@/config/kpiFramework";
import type { ObservatoryType } from "@/data/cityPilotProfiles";
import { getCityPilotProfile } from "@/data/cityPilotProfiles";
import { isIssyCity } from "@/lib/issyMapRouting";
import type {
  ObservatoryGraphicId,
  ObservatoryGraphicMatrix,
  ObservatoryGraphicSpec,
  ObservatoryGraphicZone,
  ObservatorySchematicId,
} from "@/lib/observatoryGraphicTypes";

export const OBSERVATORY_HEADER_SCHEMATIC: Record<ObservatoryType, ObservatorySchematicId> = {
  corridor: "junctionSchematic",
  camera: "cameraCorridorSchematic",
  intervention: "interventionPointsSchematic",
  "street-segment": "streetSegmentSchematic",
  area: "areaPolygonSchematic",
};

/** Base chart matrix per observatoryType × kpiId (tab zones share the same chart family). */
export const OBSERVATORY_GRAPHIC_MATRIX: ObservatoryGraphicMatrix = {
  corridor: {
    "kpi1.2": "modeShareBars",
    "kpi2.1": "junctionPressure",
    "kpi3.1": "facilityInventory",
    "kpi3.2": "climateField",
    "kpi4.1": "sentimentGauge",
    "kpi4.2": "accessibilityBars",
  },
  camera: {
    "kpi1.2": "directionModeBreakdown",
    "kpi2.1": "flowPressure",
    "kpi3.2": "motorIntensity",
  },
  intervention: {
    "kpi1.2": "telraamModeBars",
    "kpi2.1": "safetyDensity",
    "kpi3.2": "envProxy",
    "kpi4.1": "surveyLikert",
    "kpi4.2": "accessLikert",
  },
  "street-segment": {
    "kpi1.2": "segmentModeShare",
    "kpi2.1": "speedProfile",
    "kpi3.1": "facilityStrip",
    "kpi3.2": "reteBand",
    "kpi4.1": "sentiment",
    "kpi4.2": "dssBars",
  },
  area: {
    "kpi1.2": "manualCountBars",
    "kpi2.1": "motorPressure",
    "kpi3.2": "proxyDelta",
    "kpi4.1": "likertRadar",
    "kpi4.2": "accessLikert",
  },
};

type PilotGraphicOverride = Partial<
  Record<ObservatoryGraphicZone, Partial<Record<KPIFrameworkId, ObservatoryGraphicId>>>
>;

const PILOT_GRAPHIC_OVERRIDES: Record<string, PilotGraphicOverride> = {
  "cph-p1": {
    header: { "kpi1.2": "cameraCorridorSchematic", "kpi2.1": "cameraCorridorSchematic", "kpi3.2": "cameraCorridorSchematic" },
    overview: { "kpi1.2": "telraamModeBars" },
    kpiAnalysis: { "kpi1.2": "telraamModeBars", "kpi4.1": "sentimentGauge", "kpi4.2": "accessibilityBars" },
  },
  "cph-p2": {
    header: { "kpi1.2": "cameraCorridorSchematic", "kpi2.1": "cameraCorridorSchematic", "kpi3.2": "cameraCorridorSchematic" },
    overview: { "kpi3.1": "facilityInventory", "kpi4.2": "accessibilityBars" },
    kpiAnalysis: { "kpi3.1": "facilityInventory", "kpi4.2": "accessibilityBars" },
  },
  "cph-p3": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.2": "cameraCorridorSchematic",
    },
    kpiAnalysis: { "kpi4.1": "likertRadar", "kpi2.1": "flowPressure", "kpi4.2": "accessibilityBars" },
  },
  "hel-p1": { header: { "kpi2.1": "interventionPointsSchematic" } },
  "hel-p2": { header: { "kpi3.1": "interventionPointsSchematic" } },
  "mil-p2": { header: { "kpi2.1": "streetSegmentSchematic" }, kpiAnalysis: { "kpi2.1": "speedProfile" } },
  "zar-p1": { header: { "kpi1.2": "areaPolygonSchematic" } },
  "tri-p1": {
    header: { "kpi4.1": "areaPolygonSchematic" },
    kpiAnalysis: { "kpi4.1": "likertRadar", "kpi2.1": "likertRadar", "kpi4.2": "accessibilityBars" },
  },
};

const KPI_STATUS_CAPTIONS: Record<
  ObservatoryType,
  Partial<Record<KPIFrameworkId, { primary: string; secondary: string; tertiary: string }>>
> = {
  corridor: {
    "kpi1.2": {
      primary: "Mode-share context at monitored corridor",
      secondary: "OD CSV at city level — segment shows traffic context",
      tertiary: "Post-intervention monitoring",
    },
    "kpi2.1": {
      primary: "Safety pressure on monitored corridor",
      secondary: "traficissy segment speed / congestion",
      tertiary: "Post-intervention monitoring",
    },
    "kpi3.1": {
      primary: "Zero-emission facilities in buffer",
      secondary: "Cycling infrastructure inventory linked",
      tertiary: "Post-intervention monitoring",
    },
    "kpi3.2": {
      primary: "Climate / emissions field active",
      secondary: "Derived proxy from traffic intensity",
      tertiary: "Post-intervention monitoring",
    },
    "kpi4.1": {
      primary: "Citizen sentiment gauge",
      secondary: "Survey-derived perception samples",
      tertiary: "Post-intervention monitoring",
    },
    "kpi4.2": {
      primary: "Accessibility feature coverage",
      secondary: "Facility reach bands in corridor buffer",
      tertiary: "Post-intervention monitoring",
    },
  },
  camera: {
    "kpi1.2": {
      primary: "Directional camera corridor active",
      secondary: "OpenTrafficCam pre/post directional counts",
      tertiary: "Post-intervention monitoring",
    },
    "kpi2.1": {
      primary: "Flow pressure along camera corridor",
      secondary: "Directional mobility intensity observations",
      tertiary: "Post-intervention monitoring",
    },
    "kpi3.2": {
      primary: "Motor intensity proxy field",
      secondary: "Modelled from observed mobility mix",
      tertiary: "Post-intervention monitoring",
    },
  },
  intervention: {
    "kpi1.2": {
      primary: "Telraam / partner mode observations",
      secondary: "Intervention-point monitoring scope",
      tertiary: "Post-intervention monitoring",
    },
    "kpi2.1": {
      primary: "Safety density at intervention sites",
      secondary: "Dangerous-location and corridor context",
      tertiary: "Post-intervention monitoring",
    },
    "kpi3.2": {
      primary: "Environmental proxy at intervention",
      secondary: "Derived intensity from linked feeds",
      tertiary: "Post-intervention monitoring",
    },
    "kpi4.1": {
      primary: "Survey Likert distribution",
      secondary: "Citizen engagement samples",
      tertiary: "Post-intervention monitoring",
    },
    "kpi4.2": {
      primary: "Accessibility audit signals",
      secondary: "Partner accessibility datasets",
      tertiary: "Post-intervention monitoring",
    },
  },
  "street-segment": {
    "kpi1.2": {
      primary: "Segment mode-share context",
      secondary: "Monitored street segment observations",
      tertiary: "Post-intervention monitoring",
    },
    "kpi2.1": {
      primary: "Speed profile on monitored segment",
      secondary: "Segment-level safety pressure",
      tertiary: "Post-intervention monitoring",
    },
    "kpi3.1": {
      primary: "Facility strip along corridor",
      secondary: "Infrastructure inventory linked",
      tertiary: "Post-intervention monitoring",
    },
    "kpi3.2": {
      primary: "RETE / emissions band",
      secondary: "Environmental proxy along segment",
      tertiary: "Post-intervention monitoring",
    },
    "kpi4.1": {
      primary: "Sentiment along corridor",
      secondary: "Stakeholder perception samples",
      tertiary: "Post-intervention monitoring",
    },
    "kpi4.2": {
      primary: "DSS accessibility bars",
      secondary: "Accessibility feature coverage",
      tertiary: "Post-intervention monitoring",
    },
  },
  area: {
    "kpi1.2": {
      primary: "Manual count bars in intervention area",
      secondary: "Survey / count workbook aggregates",
      tertiary: "Post-intervention monitoring",
    },
    "kpi2.1": {
      primary: "Motor pressure in intervention area",
      secondary: "Area-level safety proxy",
      tertiary: "Post-intervention monitoring",
    },
    "kpi3.2": {
      primary: "Proxy delta across intervention area",
      secondary: "Derived environmental intensity",
      tertiary: "Post-intervention monitoring",
    },
    "kpi4.1": {
      primary: "Likert radar — citizen survey",
      secondary: "Area-level engagement aggregates",
      tertiary: "Post-intervention monitoring",
    },
    "kpi4.2": {
      primary: "Accessibility Likert distribution",
      secondary: "Survey-derived access perception",
      tertiary: "Post-intervention monitoring",
    },
  },
};

const EMPTY_STATE_MESSAGES: Partial<Record<ObservatoryGraphicId, string>> = {
  facilityInventory: "No facility inventory linked for this pilot.",
  motorIntensity: "Environmental intensity not available for this camera configuration.",
  facilityStrip: "No facility strip data linked for this segment.",
  reteBand: "No RETE / emissions band data linked.",
  proxyDelta: "No environmental proxy data for this intervention area.",
  accessibilityBars:
    "No EN 17210 accessibility audit for this pilot. Linked datasets: OpenTrafficCam, Telraam, manual counts, flow cameras, and surveys where applicable.",
};

const SCHEMATIC_IDS = new Set<string>([
  "junctionSchematic",
  "cameraCorridorSchematic",
  "streetSegmentSchematic",
  "interventionPointsSchematic",
  "areaPolygonSchematic",
]);

export function resolveObservatoryType(
  city: string,
  pilotId?: string | null
): ObservatoryType {
  if (isIssyCity(city)) return "corridor";
  const profile = getCityPilotProfile(pilotId);
  return profile?.observatoryType ?? "intervention";
}

export function resolveObservatoryGraphic(
  observatoryType: ObservatoryType,
  kpiId: string,
  zone: ObservatoryGraphicZone,
  pilotId?: string | null
): ObservatoryGraphicSpec | null {
  const kpi = kpiId as KPIFrameworkId;
  const pilotOverride = pilotId ? PILOT_GRAPHIC_OVERRIDES[pilotId]?.[zone]?.[kpi] : undefined;

  if (zone === "header") {
    const graphicId = pilotOverride ?? OBSERVATORY_HEADER_SCHEMATIC[observatoryType];
    return {
      graphicId,
      kind: "schematic",
      variant: "compact",
    };
  }

  const graphicId =
    pilotOverride ?? OBSERVATORY_GRAPHIC_MATRIX[observatoryType]?.[kpi] ?? null;
  if (!graphicId) {
    return {
      graphicId: "prePostTrend",
      kind: "chart",
      emptyState: `No dedicated graphic for ${kpiId} in ${observatoryType} observatories.`,
    };
  }

  const zoneVariant =
    zone === "beforeAfter" ? "directional" : zone === "kpiAnalysis" ? "expanded" : "compact";

  return {
    graphicId,
    kind: SCHEMATIC_IDS.has(graphicId) ? "schematic" : "chart",
    variant: zoneVariant,
    emptyState: EMPTY_STATE_MESSAGES[graphicId],
  };
}

export function kpiStatusCaption(
  observatoryType: ObservatoryType,
  kpiId: string,
  dataClass: string,
  city: string,
  sourceLabel?: string
): { primary: string; secondary: string; tertiary: string } {
  const kpi = kpiId as KPIFrameworkId;
  const defaults = KPI_STATUS_CAPTIONS[observatoryType]?.[kpi] ?? {
    primary: "Monitored intervention zone active",
    secondary:
      dataClass === "mock"
        ? `1 monitored corridor · pilot registry (${city})`
        : `1 monitored corridor · ${sourceLabel || "linked datasets"}`,
    tertiary: "Post-intervention monitoring",
  };

  if (dataClass === "mock") {
    return {
      ...defaults,
      secondary: `1 monitored corridor · pilot registry (${city})`,
    };
  }

  if (sourceLabel && observatoryType !== "corridor") {
    return {
      ...defaults,
      secondary: `1 monitored corridor · ${sourceLabel}`,
    };
  }

  return defaults;
}
