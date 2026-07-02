import type { LocalCityPoint } from "@/services/localCityData";

export type TrikalaThemeId = "mobility" | "infrastructure" | "safety";

export const TRIKALA_THEME_COLORS: Record<TrikalaThemeId, string> = {
  mobility: "#00ffff",
  infrastructure: "#22c55e",
  safety: "#ffb300",
};

const SEGMENT_THEME: Record<string, TrikalaThemeId> = {
  "tri-p1-women-mobility": "mobility",
  "tri-p1-village": "mobility",
  "tri-p1-caregiver": "mobility",
  "tri-p1-urban": "mobility",
  "tri-p1-suburban": "mobility",
  "tri-p1-bike-lane": "infrastructure",
  "tri-p1-smarta-app": "infrastructure",
  "tri-p1-smart-crossing": "safety",
  "tri-p1-environmental-sensor": "safety",
  "tri-p1-environmental-fleet": "safety",
};

/** Distinct accent for clustered sub-segment markers (caregiver vs village, etc.). */
const SUB_SEGMENT_ACCENT: Record<string, string> = {
  "tri-p1-caregiver": "#00ffff",
  "tri-p1-village": "#ffb300",
  "tri-p1-urban": "#22c55e",
  "tri-p1-suburban": "#a78bfa",
  "tri-p1-non-caregiver": "#63ccff",
  "tri-p1-women-mobility": "#00ffff",
  "tri-p1-bike-lane": "#22c55e",
  "tri-p1-smarta-app": "#b0edba",
  "tri-p1-smart-crossing": "#ffb300",
  "tri-p1-environmental-sensor": "#f59e0b",
  "tri-p1-environmental-fleet": "#96c2ef",
};

const SUB_SEGMENT_LABEL: Record<string, string> = {
  "tri-p1-caregiver": "Caregivers",
  "tri-p1-village": "Rural village",
  "tri-p1-urban": "Urban residents",
  "tri-p1-suburban": "Suburban residents",
  "tri-p1-women-mobility": "Women mobility",
  "tri-p1-bike-lane": "Bike lane survey",
  "tri-p1-smarta-app": "SMARTA app",
  "tri-p1-smart-crossing": "Smart crossing",
  "tri-p1-environmental-sensor": "Outdoor sensor",
  "tri-p1-environmental-fleet": "Sensor fleet",
};

export function resolveTrikalaSegmentTheme(
  segmentId: string | undefined,
  kpiId: string
): TrikalaThemeId {
  if (segmentId && SEGMENT_THEME[segmentId]) return SEGMENT_THEME[segmentId];
  if (kpiId === "kpi2.1") return "safety";
  if (kpiId === "kpi4.1" || kpiId === "kpi4.2") return "infrastructure";
  if (kpiId === "kpi1.2") return "mobility";
  return "mobility";
}

export function themeColor(theme: TrikalaThemeId): string {
  return TRIKALA_THEME_COLORS[theme];
}

export function resolveTrikalaSubSegmentAccent(segmentId: string): string {
  return SUB_SEGMENT_ACCENT[segmentId] ?? themeColor(resolveTrikalaSegmentTheme(segmentId, "kpi2.1"));
}

export function resolveTrikalaSubSegmentLabel(
  segmentId: string,
  props?: Record<string, unknown>
): string {
  const sub = String(props?.subSegment ?? "").trim();
  if (sub) return sub;
  return SUB_SEGMENT_LABEL[segmentId] ?? "Survey aggregate";
}

export function surveyMarkerHtml(options: {
  theme: TrikalaThemeId;
  accentColor: string;
  isSelected: boolean;
  intensity: number;
  isEnvironmental?: boolean;
}): string {
  const { theme, accentColor, isSelected, intensity, isEnvironmental } = options;
  const color = accentColor || themeColor(theme);
  const selectedClass = isSelected ? " is-selected" : "";
  const envClass = isEnvironmental ? " is-environmental" : "";
  const haloAlpha = 0.18 + Math.min(0.22, intensity / 220);
  const coreSize = isEnvironmental ? 6 : 8;
  return `<div class="tri-survey-marker${selectedClass}${envClass}">
    <span class="tri-survey-halo" style="background:${color};opacity:${haloAlpha.toFixed(2)}"></span>
    <span class="tri-survey-ring" style="border-color:${isSelected ? "#ffffff" : color}"></span>
    <span class="tri-survey-core" style="width:${coreSize}px;height:${coreSize}px;background:${isSelected ? color : "#ffffff"};box-shadow:0 0 8px ${color}88"></span>
  </div>`;
}

export function buildSurveyPopupHtml(point: LocalCityPoint): string {
  const props = point.properties || {};
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
  const segmentId = String(props.segmentId ?? "");
  const subLabel = resolveTrikalaSubSegmentLabel(segmentId, props);
  const accent = resolveTrikalaSubSegmentAccent(segmentId);
  const label = String(props.likertLabel ?? props.streetName ?? "Survey metric");

  return `
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:160px;">
      <p style="font-size:10px;font-weight:700;color:${accent};margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.04em;">${subLabel}</p>
      <p style="font-size:11px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${label}</p>
      <p style="font-size:18px;font-weight:bold;color:#2F1B6D;margin:0 0 4px 0;">${point.value.toFixed(1)}%</p>
      ${baselineNum !== undefined && baselineNum > 0 ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Baseline: ${baselineNum.toFixed(1)}%</p>` : ""}
      ${interventionNum !== undefined && interventionNum > 0 ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Post: ${interventionNum.toFixed(1)}%</p>` : ""}
      ${deltaNum !== undefined && baselineNum !== undefined && baselineNum > 0 ? `<p style="font-size:10px;font-weight:700;color:${deltaNum >= 0 ? "#22C55E" : "#A78BFA"};margin:2px 0;">Δ ${deltaNum >= 0 ? "+" : ""}${deltaNum.toFixed(1)} pp</p>` : ""}
      <p style="font-size:9px;color:#96C2EF;margin:4px 0 0 0;">${String(props.spatialNote ?? "Survey aggregate at pilot anchor.")}</p>
    </div>
  `;
}

export const TRIKALA_SEGMENT_RING_THEMES: Record<string, TrikalaThemeId> = {
  caregiver: "mobility",
  village: "mobility",
  urban: "mobility",
  suburban: "mobility",
  nonCaregiver: "mobility",
  all: "mobility",
};
