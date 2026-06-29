import { Printer } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import KPIChart from "@/components/KPICharts";
import type { StakeholderPrintSummary } from "@/data/narratives";
import type { KPIValue } from "@/data/kpiDefinitions";
import { formatKpiFigure } from "@/lib/formatKpiFigure";
import type { ChartDrillPayload } from "@/types/chartMapInteraction";

export interface StakeholderSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: StakeholderPrintSummary;
  city: string;
  kpiRef: string;
  kpiDisplayName: string;
  scenario: string;
  unit: string;
  baselineMainValue: number;
  interventionMainValue: number;
  headlineChange: number;
  isPositiveChange: boolean;
  baselineKvSlice: KPIValue;
  interventionKvSlice: KPIValue;
  selectedKpi: string;
  selectedCity: string;
  summaryHasBreakdown: boolean;
  chartSelectionKeys: string[];
  onChartDrill?: (payload: ChartDrillPayload) => void;
  reportHref: string;
  onPrint: () => void;
}

export function StakeholderSummaryDialog({
  open,
  onOpenChange,
  summary,
  city,
  kpiRef,
  kpiDisplayName,
  scenario,
  unit,
  baselineMainValue,
  interventionMainValue,
  headlineChange,
  isPositiveChange,
  baselineKvSlice,
  interventionKvSlice,
  selectedKpi,
  selectedCity,
  summaryHasBreakdown,
  chartSelectionKeys,
  onChartDrill,
  reportHref,
  onPrint,
}: StakeholderSummaryDialogProps) {
  const { pilotAbout } = summary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="insight-summary-dialog sm:max-w-2xl max-h-[90vh] overflow-y-auto text-foreground bg-card border-border-color p-0 gap-0">
        <div id="insight-summary-print-target" className="space-y-0">
          {/* Pilot hero — first thing stakeholders see (screen + print) */}
          <div className="rounded-t-lg bg-gradient-to-br from-violet to-violet/85 px-5 py-5 text-primary-foreground print:bg-violet print:text-white">
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-90">EU pilot intervention</p>
            <p className="text-lg font-bold mt-1">
              {city} · {pilotAbout.name}
            </p>
            <p className="text-base font-bold mt-2 leading-snug">{pilotAbout.title}</p>
            <p className="text-sm font-medium mt-3 leading-relaxed opacity-95">{pilotAbout.description}</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-primary-foreground/10 px-3 py-2 border border-primary-foreground/20">
                <p className="font-bold uppercase tracking-wide opacity-80">Intervention</p>
                <p className="font-semibold mt-1">{pilotAbout.interventionType}</p>
              </div>
              <div className="rounded-lg bg-primary-foreground/10 px-3 py-2 border border-primary-foreground/20">
                <p className="font-bold uppercase tracking-wide opacity-80">Goal</p>
                <p className="font-semibold mt-1">{pilotAbout.goal}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-primary-foreground/10 px-3 py-2 border border-primary-foreground/20">
              <p className="font-bold uppercase tracking-wide text-[10px] opacity-80">Data behind the map</p>
              <ul className="mt-1.5 space-y-1 text-sm font-medium list-disc pl-4">
                {pilotAbout.datasets.map((ds) => (
                  <li key={ds}>{ds}</li>
                ))}
              </ul>
            </div>
            {pilotAbout.focusNote && (
              <p className="mt-3 text-xs font-semibold rounded-md bg-amber-400/20 border border-amber-200/40 px-3 py-2 leading-snug">
                {pilotAbout.focusNote}
              </p>
            )}
          </div>

          <div className="px-5 py-4 space-y-4">
            <DialogHeader className="text-left space-y-1 p-0">
              <DialogTitle className="text-base font-bold text-foreground">
                KPI readout — {kpiRef} {kpiDisplayName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Scenario: {scenario}. Figures match the Before/after block below; verify in Data Summary before external quotes.
              </DialogDescription>
            </DialogHeader>

            <p className="text-sm text-muted-foreground leading-relaxed">{summary.kpiPlainLanguage}</p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-foreground/90">
              {summary.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>

            <section className="rounded-lg border border-border bg-muted/40 px-3 py-3 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Before and after</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Before</strong> is the baseline encoded for this indicator (pre-intervention).{" "}
                <strong className="text-foreground">After</strong> is the headline value on the KPI card (post-intervention). The gap is the coded shift on the card — not an independent field audit.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 text-sm pt-1">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Before</p>
                  <p className="font-semibold tabular-nums text-foreground">
                    {formatKpiFigure(baselineMainValue)}
                    <span className="text-muted-foreground font-normal ml-1">{unit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">After</p>
                  <p className="font-semibold tabular-nums text-cyan-200">
                    {formatKpiFigure(interventionMainValue)}
                    <span className="text-muted-foreground font-normal ml-1">{unit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Change on card</p>
                  <p className="font-semibold tabular-nums text-foreground">
                    {isPositiveChange ? "+" : ""}
                    {formatKpiFigure(headlineChange)}
                    {unit === "%" ? " pp" : ""}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Plots</h3>
              <p className="text-[9px] text-muted-foreground leading-snug">
                Chart selections drive the explorer map filters and camera (Pilot view).
              </p>
              {summaryHasBreakdown ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Before (baseline)</p>
                    <div className="insight-chart-panel insight-summary-chart-wrap rounded-lg overflow-hidden min-h-[200px]">
                      <KPIChart
                        kpiId={selectedKpi}
                        data={baselineKvSlice}
                        cityName={selectedCity}
                        chartSelectionKeys={chartSelectionKeys}
                        onChartDrill={onChartDrill}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">After (intervention)</p>
                    <div className="insight-chart-panel insight-summary-chart-wrap rounded-lg overflow-hidden min-h-[200px]">
                      <KPIChart
                        kpiId={selectedKpi}
                        data={interventionKvSlice}
                        cityName={selectedCity}
                        chartSelectionKeys={chartSelectionKeys}
                        onChartDrill={onChartDrill}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This KPI uses the headline metric for baseline vs after; the chart shows the intervention view only.
                  </p>
                  <div className="insight-chart-panel insight-summary-chart-wrap rounded-lg overflow-hidden min-h-[200px]">
                    <KPIChart
                      kpiId={selectedKpi}
                      data={interventionKvSlice}
                      cityName={selectedCity}
                      chartSelectionKeys={chartSelectionKeys}
                      onChartDrill={onChartDrill}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col px-5 pb-5 print:hidden">
          <Button type="button" variant="default" className="w-full gap-2 bg-violet" onClick={onPrint}>
            <Printer className="h-4 w-4" />
            Print summary with plots
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to={reportHref} target="_blank" rel="noopener noreferrer">
              Open full printable report (new tab)
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
