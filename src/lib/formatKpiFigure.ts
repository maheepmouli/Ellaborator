/** Two decimal places for KPI headline values (fixes float artefacts like 3.199999…). */
export function formatKpiFigure(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(2);
}
