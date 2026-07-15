import type { LocalCityPoint } from "@/services/localCityData";

export function filterZaragozaObservatoryPoints(
  points: LocalCityPoint[],
  selectionId: string
): LocalCityPoint[] {
  const pilotMatch = selectionId.match(/^(zar-p\d+)/);
  if (pilotMatch) {
    const scoped = points.filter((p) => p.properties?.pilotId === pilotMatch[1]);
    if (scoped.length) return scoped;
  }
  const direct = points.filter((p) => {
    const sid = String(p.properties?.segmentId ?? p.properties?.streetName ?? p.id ?? "");
    return sid === selectionId || sid.includes(selectionId) || selectionId.includes(sid);
  });
  return direct.length ? direct : points;
}

export function zaragozaCountStatCards(points: LocalCityPoint[]): {
  label: string;
  value: string;
  color?: string;
  note?: string;
}[] | null {
  const observed = points.filter(
    (p) =>
      p.properties?.datasetKind === "kpi12-workbook" ||
      p.properties?.datasetKind === "manual-count"
  );
  if (!observed.length) return null;
  const workbook = observed.filter((p) => p.properties?.datasetKind === "kpi12-workbook");
  const manual = observed.filter((p) => p.properties?.datasetKind === "manual-count");
  const sites = new Set(
    observed.map((p) => String(p.properties?.segmentId ?? p.properties?.streetName ?? p.id))
  );
  const avgValue = observed.reduce((s, p) => s + p.value, 0) / observed.length;
  return [
    {
      label: "Monitoring sites",
      value: `${sites.size}`,
      color: "#b0edba",
      note: `${observed.length} parsed record${observed.length === 1 ? "" : "s"}`,
    },
    {
      label: "Avg KPI intensity",
      value: `${avgValue.toFixed(1)}%`,
      note: workbook.length
        ? `${workbook.length} workbook slot${workbook.length === 1 ? "" : "s"}`
        : `${manual.length} manual count${manual.length === 1 ? "" : "s"}`,
    },
    {
      label: "Data class",
      value: manual.length && !workbook.length ? "Derived" : "Observed",
      note: "Zaragoza SharePoint mobility extracts",
    },
  ];
}
