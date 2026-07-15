/** Copenhagen-compatible hub markers for Trikala mobility radar sites. */

export function trikalaMobilityHubMarkerHtml(
  isSelected: boolean,
  accentColor = "#f59e0b",
  dimmed = false
): string {
  const dimStyle = dimmed ? "opacity:0.32;filter:saturate(0.55);" : "";
  return `<div class="cph-flow-camera-marker ${isSelected ? "is-selected" : ""}" style="${dimStyle}">
    <span class="cph-flow-camera-ring" style="border-color:${isSelected ? "#00ffff" : accentColor}"></span>
    <span class="cph-flow-camera-core" style="background:${isSelected ? "#00ffff" : accentColor}"></span>
  </div>`;
}

export function trikalaMobilityWorkbookRingHtml(isSelected: boolean, dimmed = false): string {
  const dimStyle = dimmed ? "opacity:0.32;filter:saturate(0.55);" : "";
  return `<div class="cph-workbook-ring ${isSelected ? "is-selected" : ""}" style="${dimStyle}"></div>`;
}
