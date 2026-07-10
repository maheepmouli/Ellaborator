import type { IssyWinticsBaselineSnapshot } from "@/types/issy-workbooks";

const SUSTAINABLE_WINTICS_MODES = ["pedestrians", "cyclists", "scooters"] as const;

export function winticsSustainableSharePct(snapshot: IssyWinticsBaselineSnapshot): number {
  const shares = snapshot.overall.modalSharePct;
  const sum = SUSTAINABLE_WINTICS_MODES.reduce((acc, key) => acc + (shares[key] ?? 0), 0);
  return Math.round(sum * 10) / 10;
}

export function formatWinticsModalShareLine(snapshot: IssyWinticsBaselineSnapshot): string {
  const shares = snapshot.overall.modalSharePct;
  const parts = [
    shares.cyclists != null ? `Cycle ${shares.cyclists.toFixed(1)}%` : null,
    shares.pedestrians != null ? `Ped ${shares.pedestrians.toFixed(1)}%` : null,
    shares.cars != null ? `Car ${shares.cars.toFixed(1)}%` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export const ISSY_WINTICS_SITE_DISCLAIMER =
  "Wintics camera counts are a point measurement at the living-lab site — distinct from city-wide zone OD CSV flows.";
