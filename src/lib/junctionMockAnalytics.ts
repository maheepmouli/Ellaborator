import type { JunctionConfig } from "@/data/junctionConfigs";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import {
  getSegmentHighlight,
  segmentMetricKindForKpi,
} from "@/lib/segmentHighlight";
import type { MapScenario } from "@/lib/junctionScenarioValues";
import type { IssyJunctionArmId } from "@/lib/issyPilot2Junction";

function kpiValueFromConfig(
  config: JunctionConfig,
  selectedKpi: string,
  scenario: MapScenario
): number {
  const period = scenario === "baseline" ? config.baseline : config.intervention;
  switch (selectedKpi) {
    case "kpi1.2":
      return (period.modeShare.Cycle ?? 0) + (period.modeShare.Pedestrian ?? 0);
    case "kpi3.2":
      return period.co2ProxyKgDay / 10;
    case "kpi3.1":
      return period.dailyCycleCount / 20;
    case "kpi4.1":
      return Math.round(config.dataConfidence * 0.9);
    case "kpi4.2":
      return Math.round(period.modeShare.Pedestrian * 1.2);
    default:
      return Math.round((1 - period.peakCongestion) * 100);
  }
}

export function buildMockJunctionStudyView(
  config: JunctionConfig,
  selectedKpi = "kpi2.1",
  scenario: MapScenario = "intervention",
  _kpi32IntensityScale = 1
): JunctionStudyView {
  const metric = segmentMetricKindForKpi(selectedKpi);
  const kpiValue = kpiValueFromConfig(config, selectedKpi, scenario);
  const highlight = getSegmentHighlight(kpiValue, kpiValue * 0.85, kpiValue * 1.15, metric);
  const kpiDef = getKpiDefinition(selectedKpi);
  const period = scenario === "baseline" ? config.baseline : config.intervention;

  return {
    id: config.id,
    segmentApiId: config.segmentApiId,
    name: config.name,
    shortName: config.shortName,
    armLabel: config.shortName,
    armId: "north" as IssyJunctionArmId,
    armColor: highlight.color,
    bandColor: highlight.color,
    kpiBand: highlight.band,
    kpiValue: Math.round(kpiValue * 10) / 10,
    selectedKpi,
    kpiLabel: kpiDef?.name ?? selectedKpi,
    pilot: config.pilot,
    interventionType: config.interventionType,
    coordinates: config.coordinates,
    monitoringPeriod: config.monitoringPeriod,
    sensors: config.sensors,
    approachesCovered: config.approachesCovered,
    totalApproaches: config.totalApproaches,
    dataConfidence: config.dataConfidence,
    baseline: config.baseline,
    intervention: config.intervention,
    timeline: config.timeline.map((e) => ({
      date: e.date,
      event: e.event,
      status: e.status === "active" ? ("done" as const) : e.status,
    })),
    dataSource: "mock",
    streetNS: config.streetNS,
    streetEW: config.streetEW,
    distanceMetres: Math.round(180 + period.avgSpeedKmh * 4),
  };
}

/** Overlay registry metadata on API-derived view; keep live metrics. */
export function mergeJunctionConfig(
  realView: JunctionStudyView,
  config: JunctionConfig
): JunctionStudyView {
  return {
    ...realView,
    shortName: config.shortName,
    name: realView.name || config.name,
    pilot: config.pilot,
    interventionType: config.interventionType,
    monitoringPeriod: config.monitoringPeriod,
    sensors: Math.max(realView.sensors, config.sensors),
    approachesCovered: realView.approachesCovered,
    totalApproaches: config.totalApproaches,
    timeline: config.timeline.map((e) => ({
      date: e.date,
      event: e.event,
      status: e.status === "active" ? ("done" as const) : e.status,
    })),
    dataSource: "observed",
    streetNS: config.streetNS,
    streetEW: config.streetEW,
  };
}
