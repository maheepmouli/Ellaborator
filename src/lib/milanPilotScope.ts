import type { MilanPilotId } from "@/data/milanPilotProfiles";
import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";

/** mil-p3 = Pilot 1 + Pilot 2 observed layers, plus CDM3-native rows (e.g. expansion hub). */
export const MILAN_COMBINED_PILOT_ID: MilanPilotId = "mil-p3";

const SOURCE_BY_SCOPE: Record<MilanPilotId, MilanPilotId[]> = {
  "mil-p1": ["mil-p1"],
  "mil-p2": ["mil-p2"],
  "mil-p3": ["mil-p1", "mil-p2", "mil-p3"],
};

/**
 * KPI 4.2 DSS civic-address points only exist for CDM1/CDM2.
 * Pilot 3 (CDM3) shows the combined Pilot 1 + Pilot 2 inventory as one layer.
 */
const ACCESSIBILITY_SOURCE_BY_SCOPE: Record<MilanPilotId, MilanPilotId[]> = {
  "mil-p1": ["mil-p1"],
  "mil-p2": ["mil-p2"],
  "mil-p3": ["mil-p1", "mil-p2"],
};

export function milanSourcePilotIds(
  pilotId: MilanPilotId | string | null | undefined
): MilanPilotId[] {
  if (!pilotId) return ["mil-p1", "mil-p2", "mil-p3"];
  if (pilotId in SOURCE_BY_SCOPE) return SOURCE_BY_SCOPE[pilotId as MilanPilotId];
  return [pilotId as MilanPilotId];
}

/** Pilot IDs whose DSS accessibility points belong in the active map/panel scope. */
export function milanAccessibilitySourcePilotIds(
  pilotId: MilanPilotId | string | null | undefined
): MilanPilotId[] {
  if (!pilotId) return ["mil-p1", "mil-p2"];
  if (pilotId in ACCESSIBILITY_SOURCE_BY_SCOPE) {
    return ACCESSIBILITY_SOURCE_BY_SCOPE[pilotId as MilanPilotId];
  }
  return milanSourcePilotIds(pilotId).filter((id) => id === "mil-p1" || id === "mil-p2");
}

export function milanIsCombinedPilot(
  pilotId: MilanPilotId | string | null | undefined
): boolean {
  return pilotId === MILAN_COMBINED_PILOT_ID;
}

export function milanRecordMatchesPilotScope(
  recordPilotId: string | null | undefined,
  scopePilotId: string | null | undefined
): boolean {
  if (!scopePilotId) return true;
  const pid = String(recordPilotId ?? "").trim();
  if (!pid) return false;
  return milanSourcePilotIds(scopePilotId).includes(pid as MilanPilotId);
}

/** Same as milanRecordMatchesPilotScope but for KPI 4.2 DSS rows (P3 = P1∪P2). */
export function milanAccessibilityRecordMatchesPilotScope(
  recordPilotId: string | null | undefined,
  scopePilotId: string | null | undefined
): boolean {
  if (!scopePilotId) return true;
  const pid = String(recordPilotId ?? "").trim();
  if (!pid) return false;
  return milanAccessibilitySourcePilotIds(scopePilotId).includes(pid as MilanPilotId);
}

export function milanPointMatchesPilotScope(
  properties: Record<string, unknown> | undefined,
  scopePilotId: string | null | undefined
): boolean {
  if (!scopePilotId) return true;
  const pid = String(properties?.pilotId ?? properties?.interventionId ?? "").trim();
  if (pid && milanRecordMatchesPilotScope(pid, scopePilotId)) return true;
  return false;
}

export function milanAccessibilityPointMatchesPilotScope(
  properties: Record<string, unknown> | undefined,
  scopePilotId: string | null | undefined
): boolean {
  if (!scopePilotId) return true;
  const pid = String(properties?.pilotId ?? properties?.interventionId ?? "").trim();
  if (pid && milanAccessibilityRecordMatchesPilotScope(pid, scopePilotId)) return true;
  return false;
}

/** Geographic union of Pilot 1 + Pilot 2 buffers (used when rows lack pilotId). */
export function isInMilanPilotScope(
  lat: number,
  lon: number,
  pilotId: MilanPilotId | string | null | undefined
): boolean {
  if (!pilotId) return true;
  const sources = milanSourcePilotIds(pilotId);
  return sources.some((src) => {
    const anchor = MILAN_PILOT_ANCHORS[src];
    const dLat = lat - anchor.lat;
    const dLon = lon - anchor.lon;
    const r2 = anchor.radiusDeg * anchor.radiusDeg;
    return dLat * dLat + dLon * dLon <= r2;
  });
}
