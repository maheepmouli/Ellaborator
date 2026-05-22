import type { ObservatoryConfig } from "@/lib/observatoryRegistry";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";

export function exportObservatoryReport(
  view: JunctionStudyView,
  config: ObservatoryConfig,
  pilotLabel?: string
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    observatoryTitle: config.title,
    kpiId: config.kpiId,
    primaryMetric: config.primaryMetricLabel,
    pilot: pilotLabel ?? view.pilot,
    segment: {
      id: view.segmentApiId,
      name: view.name,
      armLabel: view.armLabel,
      coordinates: view.coordinates,
      kpiValue: view.kpiValue,
      kpiBand: view.kpiBand,
    },
    baseline: view.baseline,
    intervention: view.intervention,
    timeline: view.timeline,
    dataConfidence: view.dataConfidence,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeId = view.segmentApiId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 48);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `elab-${config.kpiId}-${safeId}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
