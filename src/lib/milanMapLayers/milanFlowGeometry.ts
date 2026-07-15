/** Compass bearing (0 = north) for AMAT approach labels. */
export function resolveMilanFlowBearing(flowId: string, flowLabel: string): number {
  const id = String(flowId || "").toLowerCase();
  if (id === "sb") return 180;
  if (id === "nb") return 0;
  if (id === "eb") return 90;
  if (id === "wb") return 270;

  const label = String(flowLabel || "").toLowerCase();
  if (label.includes("south")) return 180;
  if (label.includes("north")) return 0;
  if (label.includes("east")) return 90;
  if (label.includes("west")) return 270;
  return 135;
}

export function milanFlowIdFromPoint(properties: Record<string, unknown> | undefined): string {
  const segmentId = String(properties?.segmentId ?? "");
  const dash = segmentId.lastIndexOf("-");
  if (dash > 0) return segmentId.slice(dash + 1);
  return "site";
}

export function milanSiteKeyFromPoint(properties: Record<string, unknown> | undefined): string {
  const explicit = String(properties?.siteKey ?? "").trim();
  if (explicit) return explicit;
  const segmentId = String(properties?.segmentId ?? "");
  const flowId = milanFlowIdFromPoint(properties);
  if (flowId !== "site" && segmentId.endsWith(`-${flowId}`)) {
    return segmentId.slice(0, -(flowId.length + 1));
  }
  return segmentId || "unknown-site";
}

export function milanSiteSegmentId(siteKey: string): string {
  return `milan-site-${siteKey}`;
}

export function milanSiteHubFromFlows(
  flows: Array<{ lat: number; lon: number }>
): { lat: number; lon: number } {
  if (!flows.length) return { lat: 0, lon: 0 };
  const lat = flows.reduce((sum, flow) => sum + flow.lat, 0) / flows.length;
  const lon = flows.reduce((sum, flow) => sum + flow.lon, 0) / flows.length;
  return { lat, lon };
}
