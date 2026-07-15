import type { LocalCityPoint } from "@/services/localCityData";

function pointRecordId(point: LocalCityPoint): string {
  return String(point.properties?.id ?? point.id ?? "");
}

export function filterHelsinkiObservatoryPoints(
  points: LocalCityPoint[],
  selectionId: string
): LocalCityPoint[] {
  const normalized = selectionId.replace(/^hel-area:/, "");
  const direct = points.filter((p) => {
    const sid = String(p.properties?.segmentId ?? p.properties?.siteId ?? p.id ?? "");
    const rid = pointRecordId(p);
    return (
      sid === selectionId ||
      rid === selectionId ||
      sid.includes(selectionId) ||
      selectionId.includes(sid) ||
      normalized.includes(sid) ||
      sid.includes(normalized)
    );
  });
  if (direct.length) return direct;
  if (selectionId.startsWith("hel-viikki")) {
    return points.filter((p) => String(p.properties?.streetName ?? "").toLowerCase().includes("viikki"));
  }
  return points;
}

export function helsinkiTelraamStatCards(points: LocalCityPoint[]): {
  label: string;
  value: string;
  color?: string;
  note?: string;
}[] | null {
  const telraam = points.filter((p) => p.properties?.datasetKind === "telraam");
  if (!telraam.length) return null;
  const avgValue = telraam.reduce((s, p) => s + p.value, 0) / telraam.length;
  const matched = telraam.filter((p) => p.properties?.spatialQuality !== "inferred").length;
  const derived = telraam.filter((p) => p.properties?.type === "derived").length;
  return [
    {
      label: "Telraam monitoring value",
      value: `${avgValue.toFixed(1)}%`,
      color: "#96c2ef",
      note: `${telraam.length} sensor segment${telraam.length === 1 ? "" : "s"}`,
    },
    {
      label: "Coordinate linkage",
      value: `${matched}/${telraam.length}`,
      note: matched ? "Matched coordinates from export" : "Ring layout from segment IDs",
    },
    {
      label: "Metric class",
      value: derived ? "Derived proxy" : "Observed",
      note: "Telraam before/after flow workbook",
    },
  ];
}
