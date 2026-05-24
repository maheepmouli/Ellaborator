export interface DatasetRenderingRule {
  datasetName: string;
  city: string;
  likelyKpi: string;
  geometryType: "point" | "segment" | "polygon" | "hex";
  renderingStyle: string;
  parserStatus: "ready" | "partial" | "planned";
  realDataStatus: "active" | "fallback";
}

export const DATASET_RENDERING_RULES: DatasetRenderingRule[] = [
  {
    datasetName: "OpenTrafficCam Counts 2024/2025",
    city: "Copenhagen",
    likelyKpi: "Mobility Mode Share, Road User Safety",
    geometryType: "point",
    renderingStyle: "Camera count points (size by count, color by KPI intensity)",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "Traffic API (traficissy)",
    city: "Issy-les-Moulineaux",
    likelyKpi: "Road User Safety, Climate & Environmental",
    geometryType: "segment",
    renderingStyle: "Road segments (speed/congestion tooltips, gradient lines)",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "Bike counter API",
    city: "Issy-les-Moulineaux",
    likelyKpi: "Mobility Mode Share",
    geometryType: "point",
    renderingStyle: "Sensor points + clustered markers",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "ISSY1 baseline/post zone-flow CSV",
    city: "Issy-les-Moulineaux",
    likelyKpi: "Mobility Mode Share",
    geometryType: "segment",
    renderingStyle: "Zone-to-zone OD arcs (city view); weekday/weekend filter in sidebar",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "Issy junction study layers",
    city: "Issy-les-Moulineaux",
    likelyKpi: "Mobility, Safety, Climate, Infrastructure",
    geometryType: "hex",
    renderingStyle:
      "Single monitored intervention corridor + climate hex field + soft influence buffer (280 m); observatory opens on monitored corridor click",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "Accessibility feature workbooks",
    city: "Milan",
    likelyKpi: "Accessibility & Security, User Satisfaction",
    geometryType: "point",
    renderingStyle: "Feature points with panel-first detail",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "Speed measurement shapefiles",
    city: "Milan",
    likelyKpi: "Road User Safety",
    geometryType: "segment",
    renderingStyle: "Road line segments with speed/risk color coding",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "CO2 and noise emissions network",
    city: "Milan",
    likelyKpi: "Climate & Environmental Impact",
    geometryType: "segment",
    renderingStyle: "Network segments with optional hex aggregation",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "Telraam / eScooter files",
    city: "Helsinki",
    likelyKpi: "Mobility Mode Share, Road User Safety proxy, Accessibility",
    geometryType: "point",
    renderingStyle: "Sensor points and eScooter clusters by category",
    parserStatus: "ready",
    realDataStatus: "active",
  },
  {
    datasetName: "Modelled environmental layers",
    city: "All",
    likelyKpi: "Climate & Environmental Impact",
    geometryType: "hex",
    renderingStyle: "Heat zones / hex intensity overlays",
    parserStatus: "partial",
    realDataStatus: "fallback",
  },
];
