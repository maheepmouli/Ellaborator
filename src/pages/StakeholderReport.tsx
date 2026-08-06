import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { getPilotById } from "@/data/pilotDefinitions";
import { getKpiFrameworkConfig } from "@/config/kpiFramework";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import Header from "@/components/Header";
import KPIChart from "@/components/KPICharts";
import { Button } from "@/components/ui/button";
import {
  stakeholderReportDisclaimer,
  buildImpactAtGlance,
  buildStakeholderPrintSummary,
  getPlainLanguageSummary,
  resolveImpactDisclaimer,
} from "@/data/narratives";
import { getIssyPilotProfile } from "@/data/issyPilotProfiles";
import {
  baselineKpiSlice,
  interventionKpiSlice,
  computeBaselineMainValue,
} from "@/lib/kpiBaselineVersusIntervention";
import { formatKpiFigure } from "@/lib/formatKpiFigure";
import { ZaragozaAccessWall } from "@/components/ZaragozaPasswordGate";
import { isZaragozaCityName, isZaragozaPilotId } from "@/lib/zaragozaAccess";

/**
 * MVP print-friendly stakeholder summary — no speculative metrics beyond CITY_DATA + selected KPI labels.
 */
const StakeholderReport = () => {
  const [params] = useSearchParams();

  const city = params.get("city") || "";
  const pilotId = params.get("pilotId") || "";
  const pilotName = params.get("pilotName") || "";
  const kpiId = params.get("kpi") || "kpi1.2";
  const scenario = (params.get("scenario") as "baseline" | "intervention" | "comparison") || "intervention";
  const needsZaragozaGate = isZaragozaCityName(city) || isZaragozaPilotId(pilotId);

  const cityData = CITY_DATA.find((c) => c.city === city);
  const kpiMeta = ELABORATOR_KPIS.find((k) => k.id === kpiId);
  const pilot = pilotId ? getPilotById(city, pilotId) : null;
  const kpiFramework = getKpiFrameworkConfig(kpiId);

  const kpiValue = cityData?.kpiData[kpiId];
  const baselineKv = kpiValue ? baselineKpiSlice(kpiValue) : null;
  const interventionKv = kpiValue ? interventionKpiSlice(kpiValue) : null;
  const reportHasBreakdown =
    !!baselineKv?.breakdown && Object.keys(baselineKv.breakdown).length > 0;

  const printReport = () => {
    window.print();
  };

  const baselineMain = kpiValue ? computeBaselineMainValue(kpiValue) : 0;
  const interventionMain = kpiValue ? Number(kpiValue.mainValue) : 0;

  const stakeholderBrief = useMemo(() => {
    if (!cityData || !kpiMeta || !kpiValue) return null;
    const helsinki = city === "Helsinki" && (kpiId === "kpi1.2" || kpiId === "kpi2.1");
    const disc = resolveImpactDisclaimer({
      kpiId,
      isMockFramework: !!kpiFramework?.isMock,
      isHelsinkiObservedBeforeAfter: helsinki,
      hasSegmentContext: false,
    });
    if (pilot) {
      const issyProfile = getIssyPilotProfile(pilot.id);
      const defaultFw = issyProfile ? getKpiFrameworkConfig(issyProfile.defaultKpi) : null;
      const focusNote =
        issyProfile && issyProfile.defaultKpi !== kpiId
          ? `Primary lens for this pilot is ${defaultFw?.displayName || issyProfile.defaultKpi}.`
          : undefined;
      return buildStakeholderPrintSummary({
        selectedCity: city,
        pilot: {
          name: pilot.name,
          title: pilot.title,
          description: pilot.description,
          interventionType: pilot.interventionType,
          goal: pilot.goal,
          datasets: pilot.datasets,
          focusNote,
        },
        kpiRef: kpiMeta.ref,
        kpiDisplayName: kpiFramework?.displayName || kpiMeta.shortName,
        kpiPlainLanguage: getPlainLanguageSummary(kpiId) || kpiMeta.question,
        scenario,
        unit: kpiValue.unit,
        baselineMainValue: baselineMain,
        interventionMainValue: interventionMain,
        headlineChange: kpiValue.change,
        disclaimerLine: disc.line,
      });
    }
    return null;
  }, [
    city,
    cityData,
    kpiMeta,
    kpiValue,
    pilot,
    scenario,
    kpiId,
    kpiFramework?.displayName,
    kpiFramework?.isMock,
    baselineMain,
    interventionMain,
  ]);

  const impact = useMemo(() => {
    if (!cityData || !kpiMeta || !kpiValue) return null;
    if (stakeholderBrief) {
      return { lead: stakeholderBrief.lead, bullets: stakeholderBrief.bullets };
    }
    const helsinki = city === "Helsinki" && (kpiId === "kpi1.2" || kpiId === "kpi2.1");
    const disc = resolveImpactDisclaimer({
      kpiId,
      isMockFramework: !!kpiFramework?.isMock,
      isHelsinkiObservedBeforeAfter: helsinki,
      hasSegmentContext: false,
    });
    return buildImpactAtGlance({
      selectedCity: city,
      pilotName: pilotName || city,
      kpiDisplayName: kpiFramework?.displayName || kpiMeta.shortName,
      scenario,
      kpiValue,
      kpiRef: kpiMeta.ref,
      changeVerb: "Change:",
      disclaimerLine: disc.line,
      headlineMainValue: interventionMain,
      headlineChange: kpiValue.change,
    });
  }, [
    city,
    cityData,
    kpiMeta,
    kpiValue,
    pilotName,
    scenario,
    kpiId,
    kpiFramework?.displayName,
    kpiFramework?.isMock,
    stakeholderBrief,
    interventionMain,
  ]);

  if (!cityData || !kpiMeta || !kpiValue) {
    const missing = (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="max-w-xl mx-auto p-8 report-print-root">
          <p className="text-sm text-muted-foreground mb-4">Missing city or KPI in the link parameters.</p>
          <Link to="/map" className="text-violet underline">
            Back to Map
          </Link>
        </main>
      </div>
    );
    return needsZaragozaGate ? (
      <ZaragozaAccessWall title="Zaragoza">{missing}</ZaragozaAccessWall>
    ) : (
      missing
    );
  }

  const kd = getKpiDefinition(kpiId);

  const report = (
    <div className="min-h-screen bg-background text-foreground print:bg-white">
      <div className="print:hidden">
        <Header />
      </div>
      <main className="max-w-3xl mx-auto px-6 py-10 report-print-root print:py-6 print:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden mb-8">
          <Link to="/map" className="text-sm text-violet hover:underline">
            Back to Map
          </Link>
          <Button type="button" onClick={printReport} className="bg-violet text-primary-foreground">
            Print / Save as PDF
          </Button>
        </div>

        <header className="border-b border-border pb-6 mb-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">ELABORATOR — stakeholder summary</p>
          <h1 className="text-2xl font-bold text-purple mt-1">
            {city}
            {(pilot || pilotName) && (
              <>
                {" "}
                · {pilot?.name || pilotName}
              </>
            )}
          </h1>
          <p className="text-sm mt-2 text-muted-foreground">
            KPI {kpiMeta.ref} ({kpiFramework?.displayName || kpiMeta.shortName}) — scenario:{" "}
            <span className="font-medium text-foreground">{scenario}</span>
          </p>
        </header>

        {stakeholderBrief && (
          <section className="mb-8 rounded-xl border border-violet/20 bg-violet/5 p-5">
            <h2 className="text-lg font-semibold text-purple mb-2">What this pilot is about</h2>
            <p className="text-sm font-semibold text-violet">{stakeholderBrief.pilotAbout.title}</p>
            <p className="text-sm mt-2 leading-relaxed">{stakeholderBrief.pilotAbout.description}</p>
            <p className="text-xs mt-3">
              <strong>Intervention:</strong> {stakeholderBrief.pilotAbout.interventionType}
              <br />
              <strong>Goal:</strong> {stakeholderBrief.pilotAbout.goal}
            </p>
            <ul className="list-disc pl-5 text-xs mt-2 space-y-0.5 text-muted-foreground">
              {stakeholderBrief.pilotAbout.datasets.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            {stakeholderBrief.pilotAbout.focusNote && (
              <p className="text-xs mt-3 text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {stakeholderBrief.pilotAbout.focusNote}
              </p>
            )}
          </section>
        )}

        {impact && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-purple mb-2">KPI readout</h2>
            {stakeholderBrief && (
              <p className="text-sm text-muted-foreground mb-3">{stakeholderBrief.kpiPlainLanguage}</p>
            )}
            <p className="text-sm leading-relaxed mb-3">{impact.lead}</p>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              {impact.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-8 rounded-xl border border-border p-5 bg-card/80 report-print-root">
          <h2 className="text-lg font-semibold text-purple mb-3">Numbers on this KPI card</h2>
          <p className="text-sm text-muted-foreground mb-3">
            <strong className="text-foreground">Before</strong> (baseline) and <strong className="text-foreground">after</strong>{" "}
            (intervention headline) use the same encoding as the map panel. The change row is the coded shift on the card.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 text-sm mb-3">
            <p>
              <span className="text-muted-foreground block text-xs uppercase tracking-wide">Before</span>
              <strong className="tabular-nums">
                {formatKpiFigure(computeBaselineMainValue(kpiValue))}
                {kpiValue.unit}
              </strong>
            </p>
            <p>
              <span className="text-muted-foreground block text-xs uppercase tracking-wide">After</span>
              <strong className="tabular-nums text-purple">
                {formatKpiFigure(Number(kpiValue.mainValue))}
                {kpiValue.unit}
              </strong>
            </p>
            <p>
              <span className="text-muted-foreground block text-xs uppercase tracking-wide">Change on card</span>
              <strong className="tabular-nums">
                {kpiValue.change > 0 ? "+" : ""}
                {formatKpiFigure(kpiValue.change)}
                {kpiMeta.unit === "%" ? " pp" : ""}
              </strong>
            </p>
          </div>
          {kd && (
            <p className="text-xs text-muted-foreground mt-4">
              <strong>Technical label:</strong> {kd.dataLabel} · {kd.dataSource}
            </p>
          )}
          {kpiFramework?.isMock && (
            <p className="text-xs mt-3 text-red-900 bg-red-100/80 px-3 py-2 rounded-md">
              This KPI framework entry is flagged as demo/mock in configuration — headline numbers may not match field
              observations until replaced with audited aggregates.
            </p>
          )}
        </section>

        {interventionKv && baselineKv && (
          <section className="mb-8 report-print-root">
            <h2 className="text-lg font-semibold text-purple mb-3">Plots (printable)</h2>
            {reportHasBreakdown ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Before (baseline)</p>
                  <div className="rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px]">
                    <KPIChart kpiId={kpiId} data={baselineKv} cityName={city} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">After (intervention)</p>
                  <div className="rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px]">
                    <KPIChart kpiId={kpiId} data={interventionKv} cityName={city} />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Baseline vs after is carried on the headline metric; the chart shows the intervention view.
                </p>
                <div className="rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px] max-w-lg">
                  <KPIChart kpiId={kpiId} data={interventionKv} cityName={city} />
                </div>
              </div>
            )}
          </section>
        )}

        {pilot && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-purple mb-2">Pilot context</h2>
            <p className="text-sm">
              <strong>{pilot.interventionType}</strong> · {pilot.goal}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Data completeness: {pilot.dataCompleteness || "partial"}</p>
          </section>
        )}

        <section className="text-xs text-muted-foreground border-t pt-6 space-y-2">
          <p>{stakeholderReportDisclaimer()}</p>
          <p>Generated read-only MVP — aligns with explorer panel fields; cite live Data Catalogue for lineage.</p>
        </section>
      </main>
    </div>
  );

  return needsZaragozaGate ? (
    <ZaragozaAccessWall title="Zaragoza">{report}</ZaragozaAccessWall>
  ) : (
    report
  );
};

export default StakeholderReport;
