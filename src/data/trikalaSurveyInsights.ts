import type { TrikalaSegmentInsight } from "@/services/trikalaSurveyParser";
import { likertToPercent } from "@/services/trikalaSurveyParser";

export interface TrikalaInsightBlock {
  id: string;
  title: string;
  metric?: string;
  narrative: string;
  sourceDatasetIds: string[];
  segment?: "caregiver" | "village" | "urban" | "bike-lane" | "all";
}

function fmtPct(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return "—";
  return `${value.toFixed(1)}%`;
}

function segmentOf(
  insights: TrikalaSegmentInsight[],
  id: TrikalaSegmentInsight["segment"]
): TrikalaSegmentInsight | undefined {
  return insights.find((i) => i.segment === id);
}

function caregiverShare(insights: TrikalaSegmentInsight[]): number {
  const all = segmentOf(insights, "all");
  const caregivers = segmentOf(insights, "caregiver");
  if (!all || !caregivers || all.responseCount === 0) return 0;
  return (caregivers.responseCount / all.responseCount) * 100;
}

export function buildTrikalaInsightBlocks(insights: TrikalaSegmentInsight[]): TrikalaInsightBlock[] {
  const all = segmentOf(insights, "all");
  const caregiver = segmentOf(insights, "caregiver");
  const village = segmentOf(insights, "village");
  const urban = segmentOf(insights, "urban");
  const blocks: TrikalaInsightBlock[] = [];

  if (!all || all.responseCount === 0) return blocks;

  const carePct = caregiverShare(insights);
  if (carePct > 0) {
    blocks.push({
      id: "care-mobility",
      title: "Care-linked mobility",
      metric: `${fmtPct(carePct)} caregivers`,
      narrative: caregiver
        ? `${fmtPct(carePct)} of women respondents provide care for dependents. Caregivers report ${fmtPct(caregiver.carModeSharePct)} car-mode share versus ${fmtPct(caregiver.activeModeSharePct)} active-mode share — higher car dependency than the city-wide sample.`
        : `${fmtPct(carePct)} of women respondents provide care for dependents, shaping trip chaining and mode choice.`,
      sourceDatasetIds: ["tri-women-mobility-survey"],
      segment: "caregiver",
    });
  }

  const dayPct = likertToPercent(all.daySafetyAvg ?? 0);
  const nightPct = likertToPercent(all.nightSafetyAvg ?? 0);
  if (dayPct > 0 || nightPct > 0) {
    const gap = dayPct - nightPct;
    blocks.push({
      id: "safety-day-night",
      title: "Day vs night safety gap",
      metric: gap > 0 ? `${gap.toFixed(0)} pt day–night gap` : undefined,
      narrative: `Women report ${fmtPct(dayPct)} daytime safety versus ${fmtPct(nightPct)} at night (n=${all.responseCount}). The day–night gap signals lighting and perceived security priorities for evening trips.`,
      sourceDatasetIds: ["tri-women-mobility-survey"],
      segment: "all",
    });
  }

  if ((all.harassmentPct ?? 0) > 0 || (all.routeAvoidancePct ?? 0) > 0) {
    blocks.push({
      id: "harassment-avoidance",
      title: "Harassment and route avoidance",
      metric: `${fmtPct(all.harassmentPct)} harassment · ${fmtPct(all.routeAvoidancePct)} avoid routes`,
      narrative: `${fmtPct(all.harassmentPct)} experienced harassment; ${fmtPct(all.routeAvoidancePct)} avoid certain routes — including respondents without direct harassment, indicating precautionary mobility constraints.`,
      sourceDatasetIds: ["tri-women-mobility-survey"],
      segment: "all",
    });
  }

  if (village && village.responseCount > 0) {
    blocks.push({
      id: "village-exclusion",
      title: "Village mobility exclusion",
      metric: `${fmtPct(village.carModeSharePct)} car · ${fmtPct(100 - (village.activeModeSharePct ?? 0))} low active share`,
      narrative: `Village residents (n=${village.responseCount}) show ${fmtPct(village.carModeSharePct)} car-mode share and limited active-mode uptake — a structural exclusion pattern relative to urban respondents (${fmtPct(urban?.activeModeSharePct)} active share in urban core).`,
      sourceDatasetIds: ["tri-women-mobility-survey"],
      segment: "village",
    });
  }

  const encroachment = all.encroachmentFactors ?? [];
  const topFactors = encroachment.slice(0, 3).map((f) => `${f.factor} (${fmtPct(f.pct)})`);
  if (topFactors.length > 0 || (all.bikeLaneSafetyAvg ?? 0) > 0) {
    const unsafePct =
      all.bikeLaneSafetyAvg && all.bikeLaneSafetyAvg > 0
        ? fmtPct(100 - likertToPercent(all.bikeLaneSafetyAvg))
        : undefined;
    blocks.push({
      id: "bike-lane-gaps",
      title: "Bike lane infrastructure gaps",
      metric: unsafePct ? `${unsafePct} feel unsafe on lanes` : undefined,
      narrative: `Baseline cycling survey (n≈310) rates lane safety ${fmtPct(likertToPercent(all.bikeLaneSafetyAvg))}, condition ${fmtPct(likertToPercent(all.bikeLaneConditionAvg))}, night cycling ${fmtPct(likertToPercent(all.bikeNightSafetyAvg))}. Top encroachment factors: ${topFactors.join("; ")}.`,
      sourceDatasetIds: ["tri-bike-lane-baseline", "tri-bike-lane-post"],
      segment: "bike-lane",
    });
  }

  blocks.push({
    id: "elaborator-hardware",
    title: "ELABORATOR deployment context",
    narrative:
      "Partner deployment plan includes 60 IoT bike sensors, 10 parking sensors, and smart-crossing nodes along the Military School corridor — hardware context for interpreting survey before/after waves.",
    sourceDatasetIds: ["tri-smart-crossing-survey", "tri-smart-crossing-post"],
    segment: "all",
  });

  return blocks;
}
