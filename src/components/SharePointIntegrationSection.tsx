import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SharepointManifestFull } from "@/data/sharepointDatasets";
import {
  CITY_INTEGRATION_ROWS,
  DROP_PIPELINE_ROWS,
  EXTRACTED_FILE_APPENDIX,
  INTEGRATION_COVERAGE,
  KPI_SOURCE_MATRIX,
  MILAN_EXTERNAL_CALLOUT,
  resolveExtractedStage,
  type ConfidenceLevel,
  type IntegrationStatus,
  type PipelineStageValue,
  type RuntimeStatus,
} from "@/data/sharepointIntegrationAudit";
import { useZaragozaUnlocked } from "@/hooks/useZaragozaUnlocked";
import { isZaragozaCityName } from "@/lib/zaragozaAccess";

const INTEGRATION_COLORS: Record<IntegrationStatus, string> = {
  integrated: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  external: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  not_integrated: "bg-white/10 text-white/75 border-white/25",
};

const RUNTIME_COLORS: Record<RuntimeStatus, string> = {
  primary: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  bundled_preferred: "bg-sky-500/30 text-sky-50 border-sky-400/50",
  partial_fallback: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  survey_derived: "bg-violet-500/30 text-violet-50 border-violet-400/50",
  mock_registry: "bg-rose-500/30 text-rose-50 border-rose-400/50",
};

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  medium: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  low: "bg-rose-500/30 text-rose-50 border-rose-400/50",
};

function StatusChip({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`catalogue-status-chip inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${className}`}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

function PipelineStageIcon({ value }: { value: PipelineStageValue }) {
  if (value === "yes") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (value === "partial") return <AlertCircle className="h-3.5 w-3.5 text-amber-400" />;
  if (value === "no") return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
  return <span className="text-[10px] text-white/35">n/a</span>;
}

function CoverageList({ title, items, tone }: { title: string; items: readonly string[]; tone?: "ok" | "warn" | "muted" }) {
  const dot =
    tone === "ok"
      ? "bg-emerald-400"
      : tone === "warn"
        ? "bg-amber-400"
        : "bg-white/30";
  return (
    <div>
      <p className="text-[11px] font-semibold text-white/70 mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[11px] text-white/55">
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface SharePointIntegrationSectionProps {
  manifest?: SharepointManifestFull | null;
}

export function SharePointIntegrationSection({ manifest }: SharePointIntegrationSectionProps) {
  const [appendixOpen, setAppendixOpen] = useState(false);
  const { unlocked: zaragozaUnlocked } = useZaragozaUnlocked();
  const manifestLabels = useMemo(
    () => new Set((manifest?.files ?? []).map((f) => f.label).filter(Boolean) as string[]),
    [manifest]
  );

  const pipelineRows = useMemo(
    () =>
      DROP_PIPELINE_ROWS.map((row) => ({
        ...row,
        extractedLive: resolveExtractedStage(row, manifestLabels),
      })),
    [manifestLabels]
  );

  const cityRows = zaragozaUnlocked
    ? CITY_INTEGRATION_ROWS
    : CITY_INTEGRATION_ROWS.filter((row) => !isZaragozaCityName(row.city));

  const kpiSourceRows = zaragozaUnlocked
    ? KPI_SOURCE_MATRIX
    : KPI_SOURCE_MATRIX.filter((row) => !isZaragozaCityName(row.city));

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border px-4 py-3 text-[12px] text-amber-100/90 leading-relaxed"
        style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
      >
        <p className="font-semibold text-amber-50 mb-1">Milan — external dataset</p>
        <p>{MILAN_EXTERNAL_CALLOUT}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <CoverageList
          title="Lighthouse cities (integrated)"
          items={INTEGRATION_COVERAGE.lighthouseIntegrated}
          tone="ok"
        />
        <CoverageList
          title="Lighthouse cities (external)"
          items={INTEGRATION_COVERAGE.lighthouseExternal}
          tone="warn"
        />
        <CoverageList
          title="Follower cities (not integrated)"
          items={INTEGRATION_COVERAGE.followerNotIntegrated}
          tone="muted"
        />
      </div>
      <CoverageList
        title="Inventory (not parsed)"
        items={INTEGRATION_COVERAGE.inventoryNotParsed}
        tone="muted"
      />

      <div>
        <p className="text-[12px] font-semibold text-white/75 mb-2">City integration maturity</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] bg-white/[0.03] hover:!bg-white/[0.03]">
                <TableHead className="text-[11px] text-white/45">City</TableHead>
                <TableHead className="text-[11px] text-white/45">Integration</TableHead>
                <TableHead className="text-[11px] text-white/45">Runtime</TableHead>
                <TableHead className="text-[11px] text-white/45">Confidence</TableHead>
                <TableHead className="text-[11px] text-white/45">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cityRows.map((row) => (
                <TableRow key={row.city} className="border-white/5">
                  <TableCell className="text-[12px] text-white/85 font-medium">{row.city}</TableCell>
                  <TableCell>
                    <StatusChip label={row.integrationStatus} className={INTEGRATION_COLORS[row.integrationStatus]} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={row.runtimeStatus} className={RUNTIME_COLORS[row.runtimeStatus]} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={row.confidence} className={CONFIDENCE_COLORS[row.confidence]} />
                  </TableCell>
                  <TableCell className="text-[11px] text-white/50 max-w-md">{row.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-white/75 mb-2">KPI data sources (SharePoint-linked)</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] bg-white/[0.03] hover:!bg-white/[0.03]">
                <TableHead className="text-[11px] text-white/45">City</TableHead>
                <TableHead className="text-[11px] text-white/45">KPI 1.2</TableHead>
                <TableHead className="text-[11px] text-white/45">KPI 2.1</TableHead>
                <TableHead className="text-[11px] text-white/45">KPI 3.1</TableHead>
                <TableHead className="text-[11px] text-white/45">KPI 3.2</TableHead>
                <TableHead className="text-[11px] text-white/45">KPI 4.1</TableHead>
                <TableHead className="text-[11px] text-white/45">KPI 4.2</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpiSourceRows.map((row) => (
                <TableRow key={row.city} className="border-white/5">
                  <TableCell className="text-[12px] text-white/85 font-medium">{row.city}</TableCell>
                  <TableCell className="text-[11px] text-white/60">{row.kpi1_2}</TableCell>
                  <TableCell className="text-[11px] text-white/60">{row.kpi2_1}</TableCell>
                  <TableCell className="text-[11px] text-white/60">{row.kpi3_1}</TableCell>
                  <TableCell className="text-[11px] text-white/60">{row.kpi3_2}</TableCell>
                  <TableCell className="text-[11px] text-white/60">{row.kpi4_1}</TableCell>
                  <TableCell className="text-[11px] text-white/60">{row.kpi4_2}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-white/75 mb-2">June 2026 drop pipeline</p>
        {manifest && (
          <p className="text-[10px] text-white/40 mb-2">
            Live manifest: {manifest.generatedAt ?? "unknown"} · {manifest.files.length} files ·{" "}
            {manifest.errors.length} errors
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] bg-white/[0.03] hover:!bg-white/[0.03]">
                <TableHead className="text-[11px] text-white/45">Asset</TableHead>
                <TableHead className="text-[11px] text-white/45 text-center">Available</TableHead>
                <TableHead className="text-[11px] text-white/45 text-center">Extracted</TableHead>
                <TableHead className="text-[11px] text-white/45 text-center">Parsed</TableHead>
                <TableHead className="text-[11px] text-white/45 text-center">Displayed</TableHead>
                <TableHead className="text-[11px] text-white/45">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipelineRows.map((row) => (
                <TableRow key={row.id} className="border-white/5">
                  <TableCell className="text-[11px] text-white/80 font-medium max-w-[200px]">{row.label}</TableCell>
                  <TableCell className="text-center">
                    <PipelineStageIcon value={row.available} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PipelineStageIcon value={row.extractedLive} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PipelineStageIcon value={row.parsed} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PipelineStageIcon value={row.displayed} />
                  </TableCell>
                  <TableCell className="text-[10px] text-white/45 max-w-xs">{row.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setAppendixOpen((v) => !v)}
          className="flex items-center gap-2 text-[12px] font-medium text-white/70 hover:text-white transition-colors"
        >
          {appendixOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Extracted file appendix ({EXTRACTED_FILE_APPENDIX.length} paths)
        </button>
        {appendixOpen && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.07]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.07] bg-white/[0.03]">
                  <TableHead className="text-[11px] text-white/45">Label</TableHead>
                  <TableHead className="text-[11px] text-white/45">Public path</TableHead>
                  <TableHead className="text-[11px] text-white/45">Source</TableHead>
                  <TableHead className="text-[11px] text-white/45">Parser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EXTRACTED_FILE_APPENDIX.map((file) => (
                  <TableRow key={file.label} className="border-white/5">
                    <TableCell className="text-[10px] text-white/75 font-mono">{file.label}</TableCell>
                    <TableCell className="text-[10px] text-white/50 font-mono max-w-md truncate">{file.publicPath}</TableCell>
                    <TableCell className="text-[10px] text-white/45">{file.sourceZip}</TableCell>
                    <TableCell className="text-[10px] text-white/45">{file.parser}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-white/45 leading-relaxed">
        Local setup: run{" "}
        <code className="text-white/60 bg-white/5 px-1 rounded">npm run extract-sharepoint</code> then{" "}
        <code className="text-white/60 bg-white/5 px-1 rounded">npm run convert-helsinki-gpkg</code>. See{" "}
        <code className="text-white/50">docs/SHAREPOINT_DATA_SETUP.md</code> in the repository.
      </p>
    </div>
  );
}
