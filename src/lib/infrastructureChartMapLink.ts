import { infraOrA11yLabelMatchesFeature } from "@/lib/travelModeMapLink";

type InfraFeatureProps = {
  type_amgt_cycl?: unknown;
  localisation?: unknown;
  infraCategory?: unknown;
};

/** Keywords and API types that correspond to KPI 3.1 chart breakdown labels. */
const CHART_LABEL_RULES: Array<{
  matchLabel: (label: string) => boolean;
  types?: string[];
  locationKeywords?: string[];
}> = [
  {
    matchLabel: (l) => /ev|charg|borne|recharge|électr|electr/.test(l),
    locationKeywords: ["charge", "recharge", "borne", "électr", "electr", "ev "],
  },
  {
    matchLabel: (l) => /bike parking|parking|stationnement|arrêt vélo/.test(l),
    types: ["Pictogrammes seuls"],
    locationKeywords: ["parking", "stationnement", "arrêt", "garage"],
  },
  {
    matchLabel: (l) => /intermodal|hub|hubs|nodal|gare|pôle/.test(l),
    locationKeywords: ["gare", "hub", "intermod", "pôle", "metro", "métro", "rer", "tram"],
  },
  {
    matchLabel: (l) => /pedestrian|piéton|green zone|voie verte|espace vert/.test(l),
    types: ["Voie verte", "Piste cyclable"],
    locationKeywords: ["piéton", "pedestrian", "verte", "green", "zone", "parc", "jardin"],
  },
  {
    matchLabel: (l) => /bande|lane|cyclable|cycle lane|dedicated/.test(l),
    types: ["Bande cyclable", "Double sens cyclable"],
    locationKeywords: ["bande", "cyclable", "piste"],
  },
];

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim();
}

function textIncludesAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

/**
 * Whether a map feature belongs to the KPI 3.1 bar the user selected in the sidebar chart.
 */
export function infrastructureChartLabelMatchesFeature(
  props: InfraFeatureProps,
  chartLabel: string
): boolean {
  if (!chartLabel) return true;

  const typeText = String(props.type_amgt_cycl ?? "");
  const locText = String(props.localisation ?? "").toLowerCase();
  const categoryText = String(props.infraCategory ?? "");

  if (infraOrA11yLabelMatchesFeature(typeText, chartLabel)) return true;
  if (infraOrA11yLabelMatchesFeature(locText, chartLabel)) return true;
  if (infraOrA11yLabelMatchesFeature(categoryText, chartLabel)) return true;

  const normalized = normalizeLabel(chartLabel);
  for (const rule of CHART_LABEL_RULES) {
    if (!rule.matchLabel(normalized)) continue;
    if (rule.types?.some((t) => typeText === t)) return true;
    if (rule.locationKeywords && textIncludesAny(locText, rule.locationKeywords)) return true;
  }

  return false;
}
