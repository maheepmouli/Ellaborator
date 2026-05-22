/**
 * Narrative overlays: optional story pins and tour copy extensions (city/pilot keyed).
 */

export type StoryPin = {
  id: string;
  /** Normalised slug: e.g. "milan", "copenhagen", "issy-les-moulineaux" */
  citySlug: string;
  pilotIds?: string[];
  lat: number;
  lng: number;
  title: string;
  body: string;
  imageUrl?: string;
};

function cityToSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/gi, "");
}

export const STORY_PINS: StoryPin[] = [
  {
    id: "mil-p2-corridor",
    citySlug: "milan",
    pilotIds: ["mil-p2"],
    lat: 45.4595,
    lng: 9.178,
    title: "Protected cycling corridor",
    body: "Policy story: corridor links hubs and schools. Compare segment KPI with city card; Milan AMAT-derived layers underpin safety and environment views.",
  },
  {
    id: "cp-p1-hub",
    citySlug: "copenhagen",
    pilotIds: ["cph-p1"],
    lat: 55.6855,
    lng: 12.559,
    title: "Parking relocation street",
    body: "OpenTrafficCam-informed counts underpin mode and flow views here; headline KPI may still aggregate demo CITY_DATA alongside map layers.",
  },
  {
    id: "hel-p1-sample",
    citySlug: "helsinki",
    pilotIds: ["hel-p1"],
    lat: 60.17,
    lng: 24.945,
    title: "Telraam-informed segment",
    body: "Before/after KPIs use Telraam flows; segment reads can differ from city-wide summaries — check badges.",
  },
];

export function getStoryPointsForPilot(displayCityName: string, pilotId: string | null | undefined): StoryPin[] {
  if (!pilotId) return [];
  const slug = cityToSlug(displayCityName);
  return STORY_PINS.filter(
    (p) => p.citySlug === slug && (!p.pilotIds || p.pilotIds.includes(pilotId))
  );
}

export type MapTourArcStep = {
  icon: "problem" | "explore" | "compare" | "quality";
  title: string;
  description: string;
  position: "center" | "left" | "right";
};

/** Full stakeholder arc Problem → Explore → Compare → Data quality */
export const MAP_TOUR_STANDARD: MapTourArcStep[] = [
  {
    icon: "problem",
    title: "Start with the problem",
    description:
      "City bubbles summarise headline KPI aggregates. Zoom in only when you need pilot-level evidence — aggregates can mix illustrative demo values with real map layers.",
    position: "center",
  },
  {
    icon: "explore",
    title: "Explore the geography",
    description:
      "Pick a pilot, then inspect segments, zones, or flows. Use the intervention toggle to relate the KPI layer to the planned change area.",
    position: "left",
  },
  {
    icon: "compare",
    title: "Compare scenarios",
    description:
      "Baseline, intervention, and comparison modes show what is available within each city’s temporal coverage — not every pair is symmetric across pilots.",
    position: "center",
  },
  {
    icon: "quality",
    title: "Check data quality",
    description:
      "Badges and the Data Summary record spatial accuracy, mocks, parsers, and fallbacks before you cite numbers externally.",
    position: "right",
  },
];

/** Short tour for policymakers (same arc, condensed) */
export const MAP_TOUR_POLICYMAKER: MapTourArcStep[] = [
  {
    icon: "problem",
    title: "What we measure",
    description: "EU-wide map with city KPI headlines — distinguish illustrative demo values from layer-backed readings.",
    position: "center",
  },
  {
    icon: "explore",
    title: "Where it happens",
    description: "Select a pilot to open the KPI panel aligned to street-scale evidence where available.",
    position: "left",
  },
  {
    icon: "compare",
    title: "Before vs after",
    description: "Use scenario toggles when the city exposes both periods.",
    position: "center",
  },
  {
    icon: "quality",
    title: "Prove it",
    description: "Open Data Summary — never export numbers without confirming observed vs mock labels.",
    position: "right",
  },
];

/** One step in `/story/:pilotId` scrolly (IntersectionObserver; no Scrollama to keep bundle small). */
export type PilotScrollStoryStep = {
  id: string;
  /** Primary heading in the scrolling article */
  title: string;
  /** Optional line above title */
  eyebrow?: string;
  /** Main prose */
  narrative: string;
  /** Bullet list under narrative */
  bullets?: string[];
  /** KPI ids for chips (informational — cross-check labels in explorer) */
  kpiHints?: readonly string[];
  /** Short pull-quote shown in sticky panel when this step is active */
  spotlight?: string;
};

/** Scrollytelling steps keyed by pilot id (`/story/:pilotId`). */
export const PILOT_SCROLL_STORIES: Record<string, PilotScrollStoryStep[]> = {
  "mil-p1": [
    {
      id: "m1-problem",
      eyebrow: "Neighbourhood low-traffic pilot",
      title: "Who this pilot serves",
      narrative:
        "Milan Pilot 1 focuses calmer corridors around everyday trips — crossings, buses, and local services. Evidence mixes AMAT corridor counts with speed segments when joins succeed.",
      bullets: [
        "Use KPI 1.2 (mode share) and KPI 4.2 (accessibility inventory) alongside map layers.",
        "Headline city card percentages may blend demo scaffolding with counted layers — read Data Summary.",
      ],
      kpiHints: ["kpi1.2", "kpi4.2", "kpi2.1", "kpi3.2"],
      spotlight: "District-scale calming — correlate mode share with safety segments.",
    },
    {
      id: "m1-how",
      eyebrow: "Working in ELABORATOR",
      title: "How to read the map here",
      narrative:
        "Zoom to Pilot 1, pick the KPI dropdown, flip baseline / intervention / comparission views when available. Dense Milan geometry may throttle some devices — lighten filters if needed.",
      bullets: ["RETE hour bands (KPI 3.2) are discrete windows — not continuous clock time.", "Segment picks update the KPI card context line when you hover or click geometry."],
      kpiHints: ["kpi1.2", "kpi3.2"],
      spotlight: "Toggle scenarios and KPIs instead of trusting the Europe-wide bubble alone.",
    },
    {
      id: "m1-share",
      eyebrow: "Reporting",
      title: "What to cite externally",
      narrative:
        "Export the printable stakeholder report after confirming observed vs derived tags. Keep photographs and policy brief separate from GIS-derived denominators.",
      spotlight: "Printable summary and map export should match the same scenario you narrate.",
    },
  ],
  "mil-p2": [
    {
      id: "s1",
      eyebrow: "Protected cycling corridor",
      title: "Context",
      narrative:
        "Pilot 2 tests a protected corridor between mobility hubs and schools. AMAT speed segments and KPI 3.2 environmental pressure ribbons show where stress concentrates before quoting mode shifts.",
      bullets: [
        "Corridor KPIs aggregate along matched segments — not every side street carries the same numerator.",
      ],
      kpiHints: ["kpi1.2", "kpi2.1", "kpi3.2"],
      spotlight: "Corridor geography first — KPI cards second.",
    },
    {
      id: "s2",
      title: "Evidence stack",
      narrative:
        "Use KPI 2.1 (risk/speed storyline) alongside KPI 3.2 RETE hour bands plus Data Summary. Shapefile joins sometimes infer — mismatched IDs fall back to illustrative hex coverage.",
      bullets: ["Open Data Catalogue health when Milan parsers flag partial joins.", "Cross-check OTC-style counts if you splice external PDF evidence."],
      kpiHints: ["kpi2.1", "kpi3.2"],
      spotlight: "Layer stack: safety segments + RETE bands + glossary tags.",
    },
    {
      id: "s3",
      title: "Next actions",
      narrative:
        "Return to `/map`, select Milano → Pilot 2, open View summary before printing. Mention scenario labels if you cite comparison mode.",
      bullets: ["Prefer pilot-scoped numbers over Europe-level aggregates.", "Screenshots carry less provenance — tag date + scenario."],
      spotlight: "Always pair narrative with pilot + scenario breadcrumbs.",
    },
  ],
  "mil-p3": [
    {
      id: "m3-lane",
      eyebrow: "Transit priority pilot",
      title: "Lanes, signals, and delay",
      narrative:
        "Pilot 3 models bus priority reallocations across network links. KPI 1.2 and greenhouse-style indicators still lean on pooled metrics — align claims with corridor-level shapes.",
      kpiHints: ["kpi1.2", "kpi3.2", "kpi4.1"],
      spotlight: "Transit reliability stories need corridor context, not just card deltas.",
    },
    {
      id: "m3-next",
      title: "Operational follow-ups",
      narrative:
        "Layer AMAT counting windows with stakeholder operating hours — weekends vs school terms change flows drastically.",
      bullets: ["Use comparison mode sparingly unless both periods sampled equally.", "Log camera blind spots referenced in DSS metadata."],
      spotlight: "Check temporal parity before asserting trend direction.",
    },
  ],
  "cph-p1": [
    {
      id: "s1",
      eyebrow: "Parking relocation corridors",
      title: "Copenhagen OTC corridor",
      narrative:
        "OpenTrafficCam-informed counts underpin many Copenhagen OTC pilots. KPI card aggregates may remain illustrative CITY_DATA scaffolding — reconcile before stakeholder slides.",
      bullets: ["Contrast map point densities with OTC export provenance.", "Note camera downtime weeks when comparing winters."],
      kpiHints: ["kpi1.2", "kpi2.1", "kpi3.2"],
      spotlight: "OTC points vs headline bubbles — reconcile first.",
    },
    {
      id: "s2",
      title: "Explore geometry",
      narrative:
        "From `/map`, open Pilot 1, compare baseline vs intervention footprints. Intervention rings help explain count spikes without implying continuous coverage elsewhere.",
      kpiHints: ["kpi1.2"],
      spotlight: "Geometry explains count spikes.",
    },
    {
      id: "s3",
      title: "Publishing checklist",
      narrative:
        "Export printable summary referencing the OTC batch ID from Data Catalogue. Mention if counts are interpolated across missing quarter-hours.",
      bullets: ["Link to OTC station metadata when quoting camera-only trends.", "Do not extrapolate OTC coverage to cyclist stress without bicycle counters nearby."],
      spotlight: "Cite OTC batch identifiers when possible.",
    },
  ],
  "hel-p1": [
    {
      id: "s1",
      eyebrow: "Before / after linkage",
      title: "Telraam-informed segments",
      narrative:
        "Helsinki Pilot 1 leans on Telraam-derived before/after flows. Spatial badges may display inferred joins when corridor geometry fails strict matching.",
      bullets: ["Segment-level deltas can invert city KPI direction — cite both scopes.", "Check Telraam firmware migration dates when aligning windows."],
      kpiHints: ["kpi1.2", "kpi2.1"],
      spotlight: "Segment vs city KPI — cite both scopes.",
    },
    {
      id: "s2",
      title: "Validation playbook",
      narrative:
        "Cross-check CSV exports vs API pulls weekly; annotate manual overrides in Data Summary comments before publication.",
      kpiHints: ["kpi1.2"],
      spotlight: "Automation drift — reconcile weekly.",
    },
    {
      id: "s3",
      title: "Talking to policymakers",
      narrative:
        "Lead with directional language when sample windows are asymmetric; reserve precise percentages for symmetrical baselines/interventions.",
      spotlight: "Asymmetric samples → directional language.",
    },
  ],
  "issy-p1": [
    {
      id: "i1-zone",
      eyebrow: "School-area mobility",
      title: "Zone-to-zone storytelling",
      narrative:
        "Issy Pilot 1 maps school Vicinity interventions through zone-to-zone flow CSV extracts. Thick ribbons on KPI 1.2 represent OD links — thinning logic caps simultaneous arcs for readability.",
      bullets: [
        "comparison mode emphasizes green ribbons for sustainable-mode uplift, purple otherwise.",
        "Zoom in early — distant views hide directional cues anchored at centroid markers.",
      ],
      kpiHints: ["kpi1.2"],
      spotlight: "Follow green vs purple arcs to explain comparission mode.",
    },
    {
      id: "i1-panel",
      title: "Sidebar ↔ map contract",
      narrative:
        "Before / After KPI lines pair with corridor metrics; use Travel modes checklist to reconcile filters with plotted ribbons.",
      bullets: ["View summary aggregates narrative bullets for printing.", "Data confidence pill reflects parser health upstream of map render."],
      kpiHints: ["kpi1.2"],
      spotlight: "Filters and KPI card must describe the same mode mix.",
    },
    {
      id: "i1-close",
      title: "Leaving the guided story",
      narrative:
        "Return to `/map`, keep pilot selection locked, and regenerate printable summary once scenario matches your deck narrative.",
      spotlight: "Regenerate stakeholder PDF after adjusting scenario tabs.",
    },
  ],
  "issy-p2": [
    {
      id: "i2-cycle",
      eyebrow: "Cycle lane continuity",
      title: "Corridor counts vs KPI card",
      narrative:
        "Pilot 2 focuses on uninterrupted cycling along commuter streets. Bicycle counting APIs and infra layers may load where joins succeed; KPI 1.2 can still blend demo scaffolding with plotted evidence.",
      bullets: [
        "Cross-check KPI 3.1 (infrastructure continuity) narratives with mapped cycle assets when exposed.",
        "Use Data Summary before claiming observed-only percentages from the headline card.",
      ],
      kpiHints: ["kpi1.2", "kpi3.1"],
      spotlight: "Layer-backed cycling evidence may differ from the city bubble.",
    },
    {
      id: "i2-map",
      title: "Reading the explorer",
      narrative:
        "From `/map`, select Issy Pilot 2, switch KPI dropdowns, and keep scenario tabs aligned with what you narrate externally.",
      kpiHints: ["kpi1.2"],
      spotlight: "Pilot scope first — KPI headline second.",
    },
    {
      id: "i2-export",
      title: "Reporting",
      narrative:
        "Generate the printable stakeholder summary after locking pilot, KPI, and scenario. Pair screenshots with the same filters as your deck.",
      spotlight: "Export only after breadcrumbs match the spoken story.",
    },
  ],
  "issy-p3": [
    {
      id: "i3-ops",
      eyebrow: "Operations tuning",
      title: "Congestion-sensitive tuning",
      narrative:
        "Pilot 3 ties signal timing and street operations to congestion-style indicators. Layers may derive from blended APIs — reserve precise deltas for symmetric windows.",
      bullets: [
        "KPI 2.1 / 3.2 storylines complement KPI 1.2 when corridors show stress hotspots.",
      ],
      kpiHints: ["kpi1.2", "kpi2.1", "kpi3.2"],
      spotlight: "Temporal parity matters before asserting trend direction.",
    },
    {
      id: "i3-quality",
      title: "Confidence and mocks",
      narrative:
        "Badges distinguish observed joins from inferred fills. Never mix comparison mode with asymmetric sampling without calling it out.",
      spotlight: "Data quality badges are part of the claim, not fine print.",
    },
    {
      id: "i3-close",
      title: "Back to explorer",
      narrative:
        "Return to `/map` with Pilot 3 selected to regenerate summaries after any scenario toggle change.",
      spotlight: "Refresh exports when scenario tabs move.",
    },
  ],
};

export const TOUR_CITY_EXAMPLES: Partial<Record<string, string>> = {
  milan: "Example: Pilot 2 uses AMAT speed segments for safety KPIs when shapefile joins succeed.",
  copenhagen: "Example: OTC camera counts underpin several pilots; KPI card may separately show demo aggregates.",
  helsinki: "Example: Telraam flows support Helsinki before/after KPIs — check inferred spatial badges.",
};
