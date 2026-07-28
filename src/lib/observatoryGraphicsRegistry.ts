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
    "kpi1.2": "cameraCorridorSchematic",
    "kpi2.1": "cameraCorridorSchematic",
    "kpi3.1": "facilityInventory",
    "kpi3.2": "motorIntensity",
    "kpi4.1": "surveyPie",
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
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.2": "motorIntensity",
    },
    overview: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "climateComparison",
    },
    beforeAfter: {
      "kpi1.2": "telraamModeBars",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "climateComparison",
    },
    kpiAnalysis: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "climateComparison",
      "kpi4.2": "accessibilityBars",
    },
  },
  "cph-p2": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.2": "motorIntensity",
    },
    overview: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "climateComparison",
      "kpi4.2": "accessibilityBars",
    },
    beforeAfter: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "climateComparison",
    },
    kpiAnalysis: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "climateComparison",
      "kpi4.2": "accessibilityBars",
    },
  },
  "cph-p3": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.2": "motorIntensity",
    },
    overview: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "climateComparison",
    },
    beforeAfter: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "climateComparison",
    },
    kpiAnalysis: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
      "kpi3.1": "facilityInventory",
      "kpi4.2": "accessibilityBars",
    },
  },
  "hel-p1": {
    header: {
      "kpi1.2": "junctionSchematic",
      "kpi2.1": "junctionSchematic",
      "kpi3.2": "junctionSchematic",
    },
    overview: {
      "kpi1.2": "modeShareBars",
      "kpi2.1": "modeShareBars",
      "kpi3.2": "modeShareBars",
    },
    beforeAfter: {
      "kpi1.2": "modeShareBars",
      "kpi2.1": "modeShareBars",
      "kpi3.2": "climateComparison",
    },
    kpiAnalysis: {
      "kpi1.2": "modeShareBars",
      "kpi2.1": "directionModeBreakdown",
      "kpi3.2": "climateComparison",
    },
  },
  "hel-p2": {
    header: {
      "kpi1.2": "facilityInventory",
      "kpi3.1": "facilityInventory",
      "kpi4.2": "accessibilityBars",
    },
    overview: {
      "kpi1.2": "modeShareBars",
      "kpi3.1": "facilityInventory",
      "kpi4.2": "accessibilityBars",
    },
    beforeAfter: {
      "kpi1.2": "prePostTrend",
      "kpi3.1": "facilityInventory",
      "kpi4.2": "accessibilityBars",
    },
    kpiAnalysis: {
      "kpi1.2": "modeShareBars",
      "kpi3.1": "facilityInventory",
      "kpi4.2": "accessibilityBars",
    },
  },
  "hel-p3": {
    header: {
      "kpi1.1": "junctionSchematic",
      "kpi1.2": "junctionSchematic",
      "kpi2.1": "junctionSchematic",
      "kpi4.1": "junctionSchematic",
      "kpi4.2": "junctionSchematic",
    },
    overview: {
      "kpi1.1": "modeShareBars",
      "kpi1.2": "modeShareBars",
      "kpi2.1": "modeShareBars",
      "kpi4.1": "modeShareBars",
      "kpi4.2": "accessibilityBars",
    },
    beforeAfter: {
      "kpi1.1": "climateComparison",
      "kpi1.2": "modeShareBars",
      "kpi2.1": "modeShareBars",
      "kpi4.1": "modeShareBars",
      "kpi4.2": "accessibilityBars",
    },
    kpiAnalysis: {
      "kpi1.1": "modeShareBars",
      "kpi1.2": "modeShareBars",
      "kpi2.1": "directionModeBreakdown",
      "kpi4.1": "likertRadar",
      "kpi4.2": "accessibilityBars",
    },
  },
  "mil-p1": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "streetSegmentSchematic",
      "kpi3.1": "streetSegmentSchematic",
      "kpi3.2": "streetSegmentSchematic",
    },
    overview: {
      "kpi1.2": "modeShareBars",
      "kpi2.1": "speedProfile",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "reteBand",
      "kpi4.2": "accessibilityBars",
    },
    beforeAfter: {
      "kpi1.2": "modeShareBars",
    },
    kpiAnalysis: {
      "kpi1.2": "modeShareBars",
      "kpi2.1": "speedProfile",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "reteBand",
      "kpi4.2": "accessibilityBars",
    },
  },
  "mil-p2": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "streetSegmentSchematic",
      "kpi3.1": "streetSegmentSchematic",
      "kpi3.2": "streetSegmentSchematic",
    },
    overview: {
      "kpi1.2": "modeShareBars",
      "kpi2.1": "speedProfile",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "reteBand",
      "kpi4.2": "accessibilityBars",
    },
    beforeAfter: {
      "kpi1.2": "modeShareBars",
    },
    kpiAnalysis: {
      "kpi1.2": "modeShareBars",
      "kpi2.1": "speedProfile",
      "kpi3.1": "facilityInventory",
      "kpi3.2": "reteBand",
      "kpi4.2": "accessibilityBars",
    },
  },
  "mil-p3": {
    header: {
      "kpi1.1": "junctionSchematic",
      "kpi4.1": "sentimentGauge",
    },
    overview: {
      "kpi1.1": "modeShareBars",
      "kpi4.1": "surveyLikert",
      "kpi4.2": "accessibilityBars",
    },
    beforeAfter: {
      "kpi4.1": "surveyPie",
    },
    kpiAnalysis: {
      "kpi1.1": "modeShareBars",
      "kpi4.1": "sentimentGauge",
      "kpi4.2": "accessibilityBars",
    },
  },
  "zar-p1": { header: { "kpi1.2": "areaPolygonSchematic" } },
  "tri-p1": {
    header: {
      "kpi2.1": "junctionSchematic",
      "kpi4.1": "junctionSchematic",
      "kpi4.2": "junctionSchematic",
    },
    overview: {
      "kpi2.1": "modeShareBars",
      "kpi4.1": "modeShareBars",
      "kpi4.2": "modeShareBars",
    },
    beforeAfter: {
      "kpi2.1": "modeShareBars",
      "kpi4.1": "modeShareBars",
      "kpi4.2": "modeShareBars",
    },
    kpiAnalysis: {
      "kpi4.1": "likertRadar",
      "kpi2.1": "likertRadar",
      "kpi4.2": "likertRadar",
      "kpi3.2": "climateComparison",
    },
  },
  "issy-p3": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
    },
    overview: { "kpi1.2": "modeShareBars", "kpi2.1": "prePostTrend" },
    kpiAnalysis: { "kpi4.1": "likertRadar", "kpi4.2": "accessibilityBars" },
  },
  "issy-p1": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
    },
    overview: { "kpi1.2": "modeShareBars", "kpi2.1": "prePostTrend" },
  },
  "issy-p2": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi2.1": "cameraCorridorSchematic",
    },
    overview: { "kpi1.2": "modeShareBars", "kpi2.1": "prePostTrend" },
  },
  "tri-p2": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi3.1": "areaPolygonSchematic",
      "kpi4.1": "areaPolygonSchematic",
    },
    overview: {
      "kpi1.2": "modeShareBars",
      "kpi3.1": "facilityInventory",
      "kpi4.1": "sentimentGauge",
    },
    beforeAfter: {
      "kpi1.2": "modeShareBars",
      "kpi3.1": "facilityInventory",
      "kpi4.1": "surveyLikert",
    },
    kpiAnalysis: {
      "kpi1.2": "modeShareBars",
      "kpi3.1": "facilityInventory",
      "kpi4.1": "surveyLikert",
    },
  },
  "tri-p3": {
    header: { "kpi2.1": "areaPolygonSchematic", "kpi4.2": "areaPolygonSchematic" },
    overview: { "kpi2.1": "modeShareBars", "kpi4.2": "likertRadar" },
    beforeAfter: { "kpi2.1": "modeShareBars", "kpi4.2": "accessibilityBars" },
    kpiAnalysis: { "kpi2.1": "likertRadar", "kpi4.2": "accessibilityBars" },
  },
  "tri-p4": {
    header: {
      "kpi1.2": "cameraCorridorSchematic",
      "kpi3.2": "interventionPointsSchematic",
      "kpi4.1": "sentimentGauge",
    },
    overview: {
      "kpi1.2": "modeShareBars",
      "kpi3.2": "climateComparison",
      "kpi4.1": "surveyLikert",
    },
    beforeAfter: {
      "kpi3.2": "climateComparison",
    },
    kpiAnalysis: {
      "kpi3.2": "climateComparison",
    },
  },
};

const KPI_STATUS_CAPTIONS: Record<
  ObservatoryType,
  Partial<Record<KPIFrameworkId, { primary: string; secondary: string; tertiary: string }>>
> = {
  corridor: {
    "kpi1.2": {
      primary: "Camera hub · mode-share ripple",
      secondary: "Same hub representation as the map — no street-segment drawing",
      tertiary: "Mode mix from observed counts in Overview",
    },
    "kpi2.1": {
      primary: "Camera hub · safety pressure",
      secondary: "Same hub aggregation as Copenhagen — no street-segment spokes on the map",
      tertiary: "Speed / congestion detail in Overview",
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
      secondary: "Mock GecoAir survey samples on corridor arms",
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
      primary: "Camera hub · mode-share ripple",
      secondary: "Same hub representation as the map — no street-segment drawing",
      tertiary: "Mode mix from observed counts in Overview",
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
      primary: "Perceived crossing safety — survey Likert",
      secondary: "Smart-crossing baseline + post workbooks (SharePoint)",
      tertiary: "Before/after perception bars in Overview",
    },
    "kpi3.1": {
      primary: "Kallio parking observation inventory",
      secondary: "509 field observations · 5 parking categories",
      tertiary: "Single-period study — planned parking sensors not delivered",
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
  surveyPie:
    "No acceptability Likert distribution linked. Load Acceptability_Intervention1 BEFORE/AFTER workbooks.",
  surveyLikert:
    "No acceptability Likert distribution linked. Load Acceptability_Intervention1 BEFORE/AFTER workbooks.",
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
  pilotId?: string | null,
  selectedSegmentId?: string | null
): ObservatoryGraphicSpec | null {
  const kpi = kpiId as KPIFrameworkId;
  const trikalaSegmentHover =
    pilotId?.startsWith("tri-") &&
    selectedSegmentId &&
    !selectedSegmentId.endsWith("-environmental-fleet") &&
    !selectedSegmentId.endsWith("-environmental-sensor");

  if (trikalaSegmentHover && zone === "header") {
    // Pilot 2 P+R — mode share uses camera-style OD links (same as Copenhagen/Issy).
    if (pilotId === "tri-p2" && kpiId === "kpi1.2") {
      return { graphicId: "cameraCorridorSchematic", kind: "schematic", variant: "compact" };
    }
    if (pilotId === "tri-p2") {
      return { graphicId: "areaPolygonSchematic", kind: "schematic", variant: "compact" };
    }
    if (kpiId === "kpi1.2") {
      return { graphicId: "cameraCorridorSchematic", kind: "schematic", variant: "compact" };
    }
    if (pilotId === "tri-p3") {
      return { graphicId: "streetSegmentSchematic", kind: "schematic", variant: "compact" };
    }
    // Pilot 1 smart-crossing KPIs are survey-led — keep junction schematic, not speed-segment shell.
    if (pilotId === "tri-p1" && ["kpi2.1", "kpi4.1", "kpi4.2"].includes(kpiId)) {
      return { graphicId: "junctionSchematic", kind: "schematic", variant: "compact" };
    }
    if (["kpi4.1", "kpi2.1", "kpi4.2", "kpi3.2"].includes(kpiId)) {
      return { graphicId: "streetSegmentSchematic", kind: "schematic", variant: "compact" };
    }
  }

  if (trikalaSegmentHover && zone === "kpiAnalysis") {
    if (kpiId === "kpi4.1" || kpiId === "kpi2.1") {
      return { graphicId: "likertRadar", kind: "chart", variant: "expanded" };
    }
    if (kpiId === "kpi4.2") {
      // Pilot 1 smart-crossing accessibility is survey Likert (Helsinki UX pattern), not DSS bars.
      if (pilotId === "tri-p1") {
        return { graphicId: "likertRadar", kind: "chart", variant: "expanded" };
      }
      return { graphicId: "accessibilityBars", kind: "chart", variant: "expanded" };
    }
    if (kpiId === "kpi3.2") {
      return { graphicId: "climateComparison", kind: "chart", variant: "expanded" };
    }
  }

  const pilotOverride = pilotId ? PILOT_GRAPHIC_OVERRIDES[pilotId]?.[zone]?.[kpi] : undefined;

  if (zone === "header") {
    // Facilities inventory chart belongs in Overview only — don't duplicate above the tabs.
    if (kpi === "kpi3.1" && (pilotId?.startsWith("cph-") || pilotOverride === "facilityInventory")) {
      return null;
    }
    // Milan KPI 4.2 — accessibility is point inventory; skip useless corridor intensity schematic.
    if (kpi === "kpi4.2" && pilotId?.startsWith("mil-")) {
      return null;
    }
    // CPH 4.1 MOCK satisfaction — compact satisfaction gauge (not empty Acceptability pie).
    if (kpi === "kpi4.1" && pilotId?.startsWith("cph-")) {
      return { graphicId: "sentimentGauge", kind: "chart", variant: "compact" };
    }
    const graphicId = pilotOverride ?? OBSERVATORY_HEADER_SCHEMATIC[observatoryType];
    return {
      graphicId,
      kind: SCHEMATIC_IDS.has(graphicId) ? "schematic" : "chart",
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
  sourceLabel?: string,
  pilotId?: string | null
): { primary: string; secondary: string; tertiary: string } {
  const kpi = kpiId as KPIFrameworkId;

  // Helsinki FVH2 parking study — never use generic "monitored corridor" copy.
  if (city === "Helsinki" && pilotId === "hel-p2" && kpiId === "kpi3.1") {
    return {
      primary: "Kallio parking observation inventory",
      secondary:
        dataClass === "mock"
          ? "Registry placeholder — link Kallio e-scooter observations"
          : sourceLabel || "509 field observations · 5 parking categories",
      tertiary: "Field observations only — 20 planned parking sensors not delivered",
    };
  }
  if (city === "Helsinki" && pilotId === "hel-p2" && kpiId === "kpi4.2") {
    return {
      primary: "Selected parking observation",
      secondary:
        dataClass === "mock"
          ? "Registry placeholder — link Kallio e-scooter observations"
          : sourceLabel || "Category + coordinates from the clicked field point",
      tertiary: "Intervention-wide category mix lives in the left insight panel",
    };
  }
  if (city === "Helsinki" && pilotId === "hel-p2" && kpiId === "kpi1.2") {
    return {
      primary: "Parking-cluster mode-share context",
      secondary: sourceLabel || "Kallio e-scooter parking clusters (no Telraam on FVH2)",
      tertiary: "Category mix updates when a cluster is selected",
    };
  }
  if (city === "Helsinki" && pilotId === "hel-p1") {
    return {
      primary: "Accident & near-miss survey evidence",
      secondary: sourceLabel || "Dangerous-location / conflict citizen submissions",
      tertiary: "No pilot-scoped mode-share sensor in this data drop",
    };
  }
  // Helsinki FVH3 Viikki UX survey — never use generic "monitored corridor" / Kallio copy.
  if (
    city === "Helsinki" &&
    (pilotId === "hel-p3" ||
      (sourceLabel && /Viikki UX/i.test(sourceLabel) && !/Kallio|eScooter/i.test(sourceLabel))) &&
    (kpiId === "kpi4.1" || kpiId === "kpi4.2" || kpiId === "kpi2.1")
  ) {
    if (pilotId === "hel-p2" && kpiId === "kpi4.2") {
      // fall through — Kallio accessibility
    } else if (kpiId === "kpi2.1") {
      return {
        primary: "Viikki crossing UX safety survey",
        secondary: "On-site survey (n=50) · Sep 2025 preliminary",
        tertiary: "Intersection only — not citywide FVH1 hazard GPKGs",
      };
    } else {
      return {
        primary: "Viikki UX survey at the light-rail crossing",
        secondary: "50 on-site responses · warning-system satisfaction (Sep 2025)",
        tertiary: "Site survey only — not area-spread points · not Kallio e-scooter data",
      };
    }
  }
  if (city === "Helsinki" && pilotId === "hel-p3") {
    if (kpiId === "kpi1.2") {
      return {
        primary: "Viikki dual-sensor mode-share monitoring",
        secondary: sourceLabel || "Telraam (counts) + Mobilysis camera (FOV)",
        tertiary: "Select a sensor on the map to highlight it in the junction diagram",
      };
    }
    return {
      primary: "Viikki intersection safety monitoring",
      secondary: sourceLabel || "Telraam Koetilantie + UX / Mobilysis context",
      tertiary: "Warning-system pilot at the Raide-Jokeri crossing",
    };
  }

  // Trikala Pilot 1 — smart-crossing survey (not mock speed / congestion).
  if (
    city === "Trikala" &&
    pilotId === "tri-p1" &&
    (kpiId === "kpi2.1" || kpiId === "kpi4.1" || kpiId === "kpi4.2")
  ) {
    return {
      primary:
        kpiId === "kpi2.1"
          ? "Smart-crossing perceived safety survey"
          : kpiId === "kpi4.1"
            ? "Smart-crossing accessibility impression survey"
            : "Smart-crossing condition & connectivity survey",
      secondary: sourceLabel || "SharePoint baseline + post survey workbooks",
      tertiary: "Before/after Likert bars — same chart family as Helsinki UX pilots",
    };
  }

  // Trikala Pilot 2 — bike uptake from P+R (Intervention Evaluation Plan · KPI 1.2).
  if (city === "Trikala" && pilotId === "tri-p2" && kpiId === "kpi1.2") {
    return {
      primary: "Bike uptake from park-and-ride facilities",
      secondary:
        sourceLabel ||
        "Illustrative % change in walking / cycling / micromobility at SMY · DEH · GiSeMi",
      tertiary:
        "Partner occupancy survey pending — map shows P+R hubs only (no CV cameras / municipal car parks)",
    };
  }

  // Trikala Pilot 2 — zero-emission facilities = the three installed P+R hubs.
  if (city === "Trikala" && pilotId === "tri-p2" && kpiId === "kpi3.1") {
    return {
      primary: "Installed park-and-ride hubs (SMY · DEH · GiSeMi)",
      secondary: sourceLabel || "Partner My Maps P+R polygons — 3 hubs",
      tertiary: "Baseline 0 → intervention 3 — map markers match the dashboard count",
    };
  }

  // Trikala Pilot 2 — no P+R satisfaction survey; mock placeholder only.
  if (city === "Trikala" && pilotId === "tri-p2" && kpiId === "kpi4.1") {
    return {
      primary: "Mock user satisfaction (no survey linked)",
      secondary: sourceLabel || "CITY_DATA placeholder — partner P+R survey pending",
      tertiary: "Map shows Park and ride station dots only — not measured satisfaction fields",
    };
  }

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
