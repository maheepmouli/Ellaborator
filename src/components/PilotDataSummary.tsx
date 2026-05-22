import type { PilotDefinition } from "@/data/pilotDefinitions";
import { getIssyPilotProfile } from "@/data/issyPilotProfiles";
import {
  dataSourceTrustLabel,
  ISSY_OD_CSV_DISCLAIMER,
  kpiPrimaryIssySource,
} from "@/lib/issyDataTransparency";
import type { LayerTrustSummary } from "@/components/LayerTrustStrip";
import { DataProvenanceBadge } from "@/components/DataProvenanceBadge";

function kpiDataNote(city: string, pilotId: string, kpiId: string): string | null {
  const isIssy = city.toLowerCase().includes("issy");
  if (!isIssy) return null;

  if (kpiId === "kpi1.2") {
    return "KPI 1.2 mode share: observed OD CSV (zone-to-zone) in city view. Junction arms show traficissy segment context only — not per-street OD values.";
  }
  if (kpiId === "kpi2.1") {
    return "KPI 2.1 safety: observed traficissy segment speed/congestion with a derived safety-pressure proxy (not an official star rating).";
  }
  if (kpiId === "kpi3.2") {
    return "KPI 3.2 climate: derived environmental pressure from traffic intensity — not measured CO₂ unless emissions data is linked.";
  }
  if (kpiId === "kpi3.1") {
    return "KPI 3.1 infrastructure: observed cycling facility API where geometry is available.";
  }
  if (pilotId === "issy-p3") {
    return "GecoAir citizen app data supports observatory narratives; map layers may use derived proxies.";
  }
  return null;
}

export interface PilotDataSummaryProps {
  pilot: PilotDefinition;
  city: string;
  selectedKpi: string;
  kpiRef: string;
  kpiDisplayName: string;
  dataQualitySummary?: LayerTrustSummary | null;
}

export function PilotDataSummary({
  pilot,
  city,
  selectedKpi,
  kpiRef,
  kpiDisplayName,
  dataQualitySummary,
}: PilotDataSummaryProps) {
  const issyProfile = getIssyPilotProfile(pilot.id);
  const kpiNote = kpiDataNote(city, pilot.id, selectedKpi);
  const isIssy = city.toLowerCase().includes("issy");
  const primarySource = isIssy ? kpiPrimaryIssySource(selectedKpi) : null;

  return (
    <div
      className="mt-3 rounded-xl border border-primary-foreground/35 bg-primary-foreground/14 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
      aria-label="Pilot data summary"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/75 mb-2">
        Pilot data summary
      </p>

      <p className="text-[11px] font-bold text-primary-foreground/90">{pilot.name}</p>
      <p className="mt-0.5 text-sm font-bold text-primary-foreground leading-snug">{pilot.title}</p>

      <p className="mt-2 text-[11px] font-medium text-primary-foreground/95 leading-relaxed line-clamp-4">
        {pilot.description}
      </p>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px]">
        <div>
          <dt className="font-bold text-primary-foreground/65 uppercase tracking-wide">Intervention</dt>
          <dd className="font-semibold text-primary-foreground/95 leading-snug">{pilot.interventionType}</dd>
        </div>
        <div>
          <dt className="font-bold text-primary-foreground/65 uppercase tracking-wide">Scale</dt>
          <dd className="font-semibold text-primary-foreground/95 capitalize">{pilot.scale}</dd>
        </div>
      </dl>

      <div className="mt-2.5 pt-2.5 border-t border-primary-foreground/20">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary-foreground/75 mb-1.5">
          Data for {kpiRef} · {kpiDisplayName}
        </p>
        <ul className="space-y-1 text-[10px] font-semibold text-primary-foreground/92 leading-snug">
          {pilot.datasets.map((ds) => (
            <li key={ds} className="flex gap-1.5">
              <span className="text-primary-foreground/50 shrink-0">•</span>
              <span>{ds}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <DataProvenanceBadge type={pilot.datasetType} />
          <span className="text-[10px] font-bold text-primary-foreground/80 capitalize">
            {pilot.dataCompleteness} data
          </span>
          {primarySource && (
            <span className="text-[10px] font-bold text-primary-foreground/90">
              · {dataSourceTrustLabel(primarySource)}
            </span>
          )}
          {dataQualitySummary?.provenanceType && (
            <DataProvenanceBadge type={dataQualitySummary.provenanceType} />
          )}
        </div>
      </div>

      {kpiNote && (
        <p className="mt-2.5 text-[10px] font-semibold text-primary-foreground/90 leading-relaxed border-t border-primary-foreground/15 pt-2">
          {kpiNote}
        </p>
      )}

      {isIssy && selectedKpi === "kpi1.2" && (
        <p className="mt-2 text-[10px] font-medium text-primary-foreground/85 leading-relaxed">
          {ISSY_OD_CSV_DISCLAIMER}
        </p>
      )}

      {issyProfile?.legendSubtitle && (
        <p className="mt-1.5 text-[10px] font-semibold text-primary-foreground/75">{issyProfile.legendSubtitle}</p>
      )}
    </div>
  );
}
