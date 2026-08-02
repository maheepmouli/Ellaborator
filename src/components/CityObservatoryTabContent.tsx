import { useMemo } from "react";
import { Database, FileText, BarChart3, Activity } from "lucide-react";
import { CITY_DATA } from "@/data/kpiDefinitions";
import { getCityPilotProfile } from "@/data/cityPilotProfiles";
import { getPilotById } from "@/data/pilotDefinitions";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { getLocalCityDiagnostics } from "@/services/localCityData";
import { getKpiMissingDataNotice } from "@/lib/kpiMissingDataMessage";
import {
  getObservatoryMethodology,
  performanceDeltaFromPoints,
} from "@/lib/observatoryCityContent";
import type { ObservatoryConfig } from "@/lib/observatoryRegistry";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { ObservatoryGraphicSlot } from "@/components/observatory/ObservatoryGraphicSlot";
import { resolveObservatoryGraphic } from "@/lib/observatoryGraphicsRegistry";
import { getCopenhagenPilotRecord } from "@/data/copenhagenPilotRegistry";
import {
  COPENHAGEN_METHODOLOGY_RULES,
  resolveMethodologyConstraint,
  type MethodologyConstraint,
} from "@/data/copenhagenLocationRegistry";
import { parseCopenhagenMapSelection, getCopenhagenLocationFromSelection } from "@/lib/copenhagenMapSelection";
import { TelraamSummaryCard } from "@/components/observatory/TelraamSummaryCard";
import { CopenhagenEvidencePanel } from "@/components/CopenhagenEvidencePanel";
import { TrikalaEvidencePanel } from "@/components/TrikalaEvidencePanel";
import { IssyEvidencePanel } from "@/components/IssyEvidencePanel";

const C = {
  border: "rgba(255,255,255,0.11)",
  glass: "rgba(255,255,255,0.055)",
  cyan: "#63ccff",
  lime: "#b0edba",
};

function GraphicSlot({
  zone,
  cityName,
  selectedPilotId,
  selectedKpi,
  view,
  scenario,
  selectedModeTypes,
  selectedDirectionId,
  onSelectDirectionId,
  selectedSegmentId,
  graphicOverride,
}: {
  zone: "overview" | "beforeAfter" | "kpiAnalysis";
  cityName: string;
  selectedPilotId?: string | null;
  selectedKpi: string;
  view: JunctionStudyView;
  scenario: MapScenario;
  selectedModeTypes?: string[];
  selectedDirectionId?: string | null;
  onSelectDirectionId?: (id: string | null) => void;
  selectedSegmentId?: string | null;
  graphicOverride?: "prePostTrend" | "modeShareBars" | "sentimentGauge" | "accessibilityBars" | "climateComparison" | "facilityInventory";
}) {
  return (
    <ObservatoryGraphicSlot
      zone={zone}
      cityName={cityName}
      pilotId={selectedPilotId}
      selectedKpi={selectedKpi}
      view={view}
      scenario={scenario}
      selectedModeTypes={selectedModeTypes}
      selectedDirectionId={selectedDirectionId}
      onSelectDirectionId={onSelectDirectionId}
      selectedSegmentId={selectedSegmentId}
      graphicOverride={graphicOverride}
    />
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-white ${className}`}
      style={{ background: C.glass, borderColor: C.border }}
    >
      {children}
    </div>
  );
}

function SourceTag({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] text-white/70"
      style={{ borderColor: C.border, background: "rgba(255,255,255,0.04)" }}
    >
      <Database className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function MethodologyCaveatsBox({
  ruleSet,
  ruleKey,
}: {
  ruleSet: MethodologyConstraint;
  ruleKey?: string;
}) {
  const appliedControls: string[] = [];
  if (ruleSet.excludePedestrians) appliedControls.push("Pedestrian counts excluded from evaluation");
  if (ruleSet.excludeBicycles) appliedControls.push("Bicycle counts excluded from evaluation");
  ruleSet.directionalExclusions?.forEach((entry) => {
    appliedControls.push(`${entry.direction} · ${entry.modes.join(" + ")} excluded`);
  });

  return (
    <GlassCard className="border-amber-400/35 bg-amber-500/10">
      {ruleKey ? (
        <p className="text-[11px] font-semibold text-amber-100/95 capitalize">{ruleKey.replace(/-/g, " ")}</p>
      ) : null}
      {appliedControls.length > 0 && (
        <ul className={`list-disc pl-4 text-[11px] text-amber-100/80 space-y-0.5 ${ruleKey ? "mt-2" : ""}`}>
          {appliedControls.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {ruleSet.warnings?.map((warning) => (
        <p key={warning} className="mt-2 text-[10px] text-amber-200/75 leading-relaxed">
          {warning}
        </p>
      ))}
    </GlassCard>
  );
}

interface CityObservatoryTabContentProps {
  tabId: string;
  cityName: string;
  selectedPilotId?: string | null;
  selectedKpi: string;
  scenario: MapScenario;
  view: JunctionStudyView;
  config: ObservatoryConfig;
  selectedModeTypes?: string[];
  selectedDirectionId?: string | null;
  onSelectDirectionId?: (id: string | null) => void;
  selectedSegmentId?: string | null;
}

export function CityObservatoryTabContent({
  tabId,
  cityName,
  selectedPilotId,
  selectedKpi,
  scenario,
  view,
  config,
  selectedModeTypes = [],
  selectedDirectionId,
  onSelectDirectionId,
  selectedSegmentId,
}: CityObservatoryTabContentProps) {
  const isCopenhagen = cityName.toLowerCase().includes("copenhagen");
  const isTrikala = cityName.toLowerCase().includes("trikala");
  const isIssy = cityName.toLowerCase().includes("issy");
  const cphPilot = isCopenhagen ? getCopenhagenPilotRecord(selectedPilotId) : null;
  const methodologyRule = isCopenhagen
    ? resolveMethodologyConstraint({
        selectionId: selectedSegmentId,
        siteName: view.name,
      })
    : undefined;
  const methodologyRuleKey = useMemo(() => {
    if (!isCopenhagen || !methodologyRule) return undefined;
    const parsed = parseCopenhagenMapSelection(selectedSegmentId);
    if (parsed.kind === "site" && parsed.workbookKey) return parsed.workbookKey;
    return Object.entries(COPENHAGEN_METHODOLOGY_RULES).find(([, rule]) => rule === methodologyRule)?.[0];
  }, [isCopenhagen, methodologyRule, selectedSegmentId]);
  const selectedTelraamLocation = useMemo(() => {
    if (!isCopenhagen) return null;
    const loc = getCopenhagenLocationFromSelection(selectedSegmentId);
    if (loc?.kind === "telraam_counter") return loc;
    return null;
  }, [isCopenhagen, selectedSegmentId]);
  const profile = getCityPilotProfile(selectedPilotId);
  const pilot = getPilotById(cityName, selectedPilotId);
  const methodology = getObservatoryMethodology(cityName, selectedKpi);
  const kpiDef = getKpiDefinition(selectedKpi);
  const cityCenter = useMemo(() => {
    const row = CITY_DATA.find((c) => c.city === cityName);
    return row ? { lat: row.lat, lon: row.lon } : null;
  }, [cityName]);

  const { data: points = [] } = useLocalCityData(
    cityName,
    selectedKpi,
    cityCenter,
    selectedPilotId,
    scenario
  );
  const diagnostics = getLocalCityDiagnostics(cityName, selectedKpi, selectedPilotId);
  const observedPoints = useMemo(
    () =>
      points.filter(
        (p) =>
          p.properties?.dataOrigin === "local-city-dataset" ||
          p.properties?.dataOrigin === "mock" ||
          p.properties?.type === "observed" ||
          p.properties?.type === "derived" ||
          p.properties?.type === "mock" ||
          p.properties?.mockLabel === "MOCK"
      ),
    [points]
  );
  const values = observedPoints.map((p) => p.value);
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : view.kpiValue;
  const min = values.length ? Math.min(...values) : avg;
  const max = values.length ? Math.max(...values) : avg;
  const perfDelta = performanceDeltaFromPoints(observedPoints);
  const missingNotice =
    getKpiMissingDataNotice(cityName, selectedKpi, pilot) ||
    diagnostics?.message ||
    config.emptyState;

  const graphicProps = {
    cityName,
    selectedPilotId,
    selectedKpi,
    view,
    scenario,
    selectedModeTypes,
  selectedDirectionId,
  onSelectDirectionId,
  selectedSegmentId,
};

  // Hub map already leads the panel header — skip duplicate schematic in Overview.
  const overviewGraphic = resolveObservatoryGraphic(
    profile?.observatoryType ?? "camera",
    selectedKpi,
    "overview",
    selectedPilotId,
    selectedSegmentId
  );
  const headerGraphic = resolveObservatoryGraphic(
    profile?.observatoryType ?? "camera",
    selectedKpi,
    "header",
    selectedPilotId,
    selectedSegmentId
  );
  const skipOverviewHubMap =
    (overviewGraphic?.graphicId === "cameraCorridorSchematic" ||
      overviewGraphic?.graphicId === "surveyPie") &&
    (profile?.observatoryType === "camera" || isCopenhagen);
  // Header already shows mode-share bars (e.g. Milan KPI 1.2) — don't repeat under Overview.
  // Also skip when Overview is already a different chart (e.g. Milan KPI 2.1 speedProfile).
  const skipOverviewModeShare =
    headerGraphic?.graphicId === "modeShareBars" ||
    headerGraphic?.graphicId === "segmentModeShare" ||
    headerGraphic?.graphicId === "telraamModeBars" ||
    headerGraphic?.graphicId === "manualCountBars" ||
    overviewGraphic?.graphicId === "speedProfile" ||
    overviewGraphic?.graphicId === "facilityInventory" ||
    overviewGraphic?.graphicId === "reteBand" ||
    overviewGraphic?.graphicId === "accessibilityBars" ||
    overviewGraphic?.graphicId === "climateComparison";

  if (tabId === "overview") {
    return (
      <div className="space-y-3">
        {selectedTelraamLocation ? (
          <TelraamSummaryCard locationId={selectedTelraamLocation.id} />
        ) : null}
        {/* Mode-share comparison only when Overview is not already a dedicated KPI chart. */}
        {!skipOverviewModeShare ? (
          <GraphicSlot zone="overview" graphicOverride="modeShareBars" {...graphicProps} />
        ) : overviewGraphic ? (
          <GraphicSlot zone="overview" {...graphicProps} />
        ) : null}
        {!skipOverviewHubMap &&
        overviewGraphic?.graphicId !== "modeShareBars" &&
        overviewGraphic?.graphicId !== "prePostTrend" &&
        overviewGraphic?.graphicId !== "speedProfile" &&
        overviewGraphic?.graphicId !== "facilityInventory" &&
        overviewGraphic?.graphicId !== "reteBand" &&
        overviewGraphic?.graphicId !== "accessibilityBars" &&
        !(skipOverviewModeShare && overviewGraphic?.graphicId === headerGraphic?.graphicId) ? (
          <GraphicSlot zone="overview" {...graphicProps} />
        ) : null}
        <GlassCard>
          <p className="text-[11px] font-semibold text-white/90">Pilot overview</p>
          <p className="mt-1 text-[11px] text-white/75 leading-relaxed">
            {profile?.interventionSummary || config.subtitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <SourceTag label={String((view as { sourceLabel?: string }).sourceLabel || kpiDef?.dataLabel || "Linked dataset")} />
          </div>
        </GlassCard>
        <GlassCard>
          <p className="text-[11px] font-semibold text-white/90">Objectives</p>
          <ul className="mt-1 list-disc pl-4 text-[11px] text-white/75 space-y-0.5">
            {(cphPilot
              ? [cphPilot.objective.primary, ...cphPilot.objective.secondary]
              : profile?.objectives || ["Track intervention performance with explicit data readiness."]
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </GlassCard>
        {cphPilot && (
          <GlassCard>
            <p className="text-[11px] font-semibold text-white/90">Evaluation focus</p>
            <p className="mt-1 text-[11px] text-white/75 leading-relaxed capitalize">
              {cphPilot.evaluation.focus} · {cphPilot.evaluation.methods.join(" · ")}
            </p>
            {cphPilot.evaluation.caveats.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-[11px] text-white/65 space-y-0.5">
                {cphPilot.evaluation.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            )}
          </GlassCard>
        )}
        <GlassCard>
          <p className="text-[11px] font-semibold text-white/90">Expected impacts</p>
          <ul className="mt-1 list-disc pl-4 text-[11px] text-white/75 space-y-0.5">
            {(profile?.expectedImpacts || ["Transparent pilot-level evidence for stakeholders."]).map(
              (item) => (
                <li key={item}>{item}</li>
              )
            )}
          </ul>
        </GlassCard>
        {methodologyRule ? (
          <MethodologyCaveatsBox ruleSet={methodologyRule} ruleKey={methodologyRuleKey} />
        ) : null}
        {observedPoints.length === 0 && missingNotice && (
          <GlassCard className="border-amber-400/35 bg-amber-500/10">
            <p className="text-[11px] text-amber-100/90 leading-relaxed">{missingNotice}</p>
          </GlassCard>
        )}
      </div>
    );
  }

  if (tabId === "data") {
    const sourceFile = String(observedPoints[0]?.properties?.sourceFile || methodology?.sources[0] || "Data Catalogue");
    return (
      <div className="space-y-3">
        <GlassCard>
          <p className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" /> Data availability
          </p>
          <p className="mt-1 text-[11px] text-white/75">{profile?.dataAvailability || "Partial — see Data Catalogue"}</p>
          <p className="mt-2 text-[11px] text-white/75">Points in scope: {observedPoints.length}</p>
          <p className="text-[11px] text-white/75">Scenario: {scenario}</p>
          <p className="text-[11px] text-white/75">Primary file: {sourceFile}</p>
          <div className="mt-2">
            <SourceTag label={kpiDef?.dataLabel || "Dataset-linked"} />
          </div>
        </GlassCard>
        {methodology?.sources.length ? (
          <GlassCard>
            <p className="text-[11px] font-semibold text-white/90">Linked sources</p>
            <ul className="mt-1 list-disc pl-4 text-[11px] text-white/75 space-y-0.5">
              {methodology.sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </GlassCard>
        ) : null}
      </div>
    );
  }

  if (tabId === "beforeAfter") {
    const beforeAfterGraphic = resolveObservatoryGraphic(
      profile?.observatoryType ?? "camera",
      selectedKpi,
      "beforeAfter",
      selectedPilotId,
      selectedSegmentId
    );
    const skipBeforeAfterHubMap =
      beforeAfterGraphic?.graphicId === "cameraCorridorSchematic" &&
      (profile?.observatoryType === "camera" || isCopenhagen);

    return (
      <div className="space-y-3">
        {!skipBeforeAfterHubMap ? <GraphicSlot zone="beforeAfter" {...graphicProps} /> : null}
        <GlassCard>
          <p className="text-[11px] font-semibold text-white/90">Temporal scope</p>
          <p className="mt-1 text-[11px] text-white/75">{view.monitoringPeriod}</p>
          <p className="text-[11px] text-white/75">Active scenario: {scenario}</p>
          {perfDelta != null && (
            <p className="mt-2 text-[11px]" style={{ color: C.lime }}>
              Mean comparison delta: {perfDelta > 0 ? "+" : ""}
              {perfDelta.toFixed(1)} (linked points)
            </p>
          )}
          <div className="mt-2">
            <SourceTag label={kpiDef?.dataSource || "Partner monitoring feed"} />
          </div>
        </GlassCard>
      </div>
    );
  }

  if (tabId === "kpiAnalysis") {
    if (selectedKpi === "kpi4.2" && cityName === "Copenhagen" && selectedPilotId !== "cph-p2") {
      return (
        <div className="space-y-3">
          <GraphicSlot zone="kpiAnalysis" {...graphicProps} />
          <GlassCard className="border-amber-400/35 bg-amber-500/10">
            <p className="text-[11px] text-amber-100/90 leading-relaxed">
              No EN 17210 accessibility audit for this pilot. The observatory lists linked observed datasets;
              CPHK2 (Vandkunsten) shows a derived infrastructure proxy from parking inventory before/after.
            </p>
          </GlassCard>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <GraphicSlot zone="kpiAnalysis" {...graphicProps} />
        <GlassCard>
          <p className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> KPI summary
          </p>
          <p className="mt-1 text-[11px] text-white/75">
            {kpiDef?.name || selectedKpi}: <strong>{avg.toFixed(1)}</strong>
          </p>
          <p className="text-[11px] text-white/75">
            Range {min.toFixed(1)} – {max.toFixed(1)} · {observedPoints.length} point
            {observedPoints.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2">
            <SourceTag label={kpiDef?.dataLabel || "Calculated from linked datasets"} />
          </div>
        </GlassCard>
      </div>
    );
  }

  if (tabId === "methodology") {
    const selectionKind = parseCopenhagenMapSelection(selectedSegmentId).kind;
    return (
      <div className="space-y-3">
        {methodologyRule ? (
          <MethodologyCaveatsBox ruleSet={methodologyRule} ruleKey={methodologyRuleKey} />
        ) : null}
        {isCopenhagen && (
          <GlassCard>
            <p className="text-[11px] font-semibold text-white/90">Maria Risom workbook rules</p>
            <p className="mt-1 text-[11px] text-white/75 leading-relaxed">
              Partner methodology constraints applied when aggregating OpenTrafficCam directional counts.
              {selectionKind ? ` Active selection: ${selectionKind}.` : ""}
            </p>
            <ul className="mt-2 space-y-2">
              {Object.entries(COPENHAGEN_METHODOLOGY_RULES).map(([key, rule]) => (
                <li key={key} className="text-[10px] text-white/65 leading-relaxed">
                  <span className="font-semibold text-white/80 capitalize">{key.replace(/-/g, " ")}</span>
                  {rule.warnings[0] ? ` — ${rule.warnings[0]}` : ""}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}
        {isCopenhagen && (
          <GlassCard>
            <CopenhagenEvidencePanel pilotId={selectedPilotId} />
          </GlassCard>
        )}
        {isTrikala && (
          <GlassCard>
            <TrikalaEvidencePanel pilotId={selectedPilotId} />
          </GlassCard>
        )}
        {isIssy && (
          <GlassCard>
            <IssyEvidencePanel pilotId={selectedPilotId} />
          </GlassCard>
        )}
        <GlassCard>
          <p className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Methodology
          </p>
          <p className="mt-1 text-[11px] text-white/75 leading-relaxed">
            {profile?.methodologyNotes || "Intervention metrics follow linked dataset parsers with explicit readiness."}
          </p>
        </GlassCard>
        {methodology && (
          <>
            <GlassCard>
              <p className="text-[11px] font-semibold text-white/90">Meaning</p>
              <p className="mt-1 text-[11px] text-white/75 leading-relaxed">{methodology.meaning}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-[11px] font-semibold text-white/90">Calculation</p>
              <p className="mt-1 text-[11px] text-white/75 leading-relaxed">{methodology.calculationMethod}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-[11px] font-semibold text-white/90">Limitations</p>
              <p className="mt-1 text-[11px] text-white/75 leading-relaxed">{methodology.limitations}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Readiness: {methodology.readiness}
              </p>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-white/75">
                {methodology.sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </GlassCard>
          </>
        )}
      </div>
    );
  }

  return null;
}
