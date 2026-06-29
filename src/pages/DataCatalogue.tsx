import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Database,
  MapPin,
  GitBranch,
  ActivitySquare,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Filter,
  Download,
  Info,
  FileText,
} from "lucide-react";
import Header from "@/components/Header";
import IssyKpiMethodologySection from "@/components/IssyKpiMethodologySection";
import CityKpiMethodologySection from "@/components/CityKpiMethodologySection";
import { SharePointIntegrationSection } from "@/components/SharePointIntegrationSection";
import { InterventionGeometrySection } from "@/components/InterventionGeometrySection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DATASET_REGISTRY,
  ALL_CITIES,
  type DatasetMetadata,
  type ParserStatus,
  type RealDataStatus,
  type GeometryQuality,
  type DataType,
} from "@/data/datasetMetadata";
import {
  KPI_READINESS_MATRIX,
  getCityReadinessSummary,
  type KpiReadiness,
} from "@/data/kpiReadinessMatrix";
import { ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { fetchSharepointManifestFull } from "@/data/sharepointDatasets";
import {
  CITY_INTEGRATION_ROWS,
  DROP_PIPELINE_ROWS,
  KPI_SOURCE_MATRIX,
  SHAREPOINT_LIGHTHOUSE_INTEGRATED_COUNT,
} from "@/data/sharepointIntegrationAudit";
import { PILOT_GEOMETRY_ROWS, CITY_DASHBOARD_FIRST_SUMMARY } from "@/data/interventionGeometryAudit";
import { useWorkflowHealth } from "@/hooks/use-workflow-health";

// ─── Badge helpers ────────────────────────────────────────────────────────────

/** Status chips tuned for the catalogue’s dark glass UI (readable on #0d0d1a, including row hover). */
const PARSER_COLORS: Record<ParserStatus, string> = {
  ready: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  partial: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  planned: "bg-sky-500/30 text-sky-50 border-sky-400/50",
  none: "bg-white/10 text-white/75 border-white/25",
};

const REAL_DATA_COLORS: Record<RealDataStatus, string> = {
  active: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  fallback: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  mock: "bg-rose-500/30 text-rose-50 border-rose-400/50",
};

const GEO_QUALITY_COLORS: Record<GeometryQuality, string> = {
  exact: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  matched: "bg-sky-500/30 text-sky-50 border-sky-400/50",
  inferred: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  missing: "bg-rose-500/30 text-rose-50 border-rose-400/50",
};

const DATA_TYPE_COLORS: Record<DataType, string> = {
  // White label on saturated chip — violet-on-violet (text-violet-50) was unreadable on dark UI
  observed: "bg-violet-600 border-violet-300/70 text-white shadow-sm",
  derived: "bg-sky-700 border-sky-300/70 text-white shadow-sm",
  modelled: "bg-amber-700 border-amber-300/70 text-white shadow-sm",
  mock: "bg-white/15 border-white/30 text-white shadow-sm",
};

const READINESS_COLORS: Record<KpiReadiness, string> = {
  ready: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  partial: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  missing: "bg-white/10 text-white/60 border-white/20",
};

const READINESS_ICON: Record<KpiReadiness, React.ReactNode> = {
  ready: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
  partial: <AlertCircle className="h-3 w-3 text-amber-400" />,
  missing: <XCircle className="h-3 w-3 text-white/25" />,
};

const CITY_ACCENT: Record<string, string> = {
  "Issy-les-Moulineaux": "border-violet-500/40 from-violet-500/10",
  Copenhagen: "border-blue-500/40 from-blue-500/10",
  Helsinki: "border-teal-500/40 from-teal-500/10",
  Milan: "border-amber-500/40 from-amber-500/10",
  Zaragoza: "border-rose-500/40 from-rose-500/10",
};

const CITY_DOT: Record<string, string> = {
  "Issy-les-Moulineaux": "bg-violet-400",
  Copenhagen: "bg-blue-400",
  Helsinki: "bg-teal-400",
  Milan: "bg-amber-400",
  Zaragoza: "bg-rose-400",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-2xl border bg-white/[0.04] backdrop-blur-sm ${className}`}
      style={{ borderColor: "rgba(255,255,255,0.10)" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="mt-0.5 rounded-lg bg-white/[0.06] border border-white/10 p-2 text-white/70">
        {icon}
      </div>
      <div>
        <h2 className="text-[15px] font-semibold text-white leading-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[12px] text-white/45 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

const CATALOGUE_SELECT_CONTENT =
  "bg-[#141428] border-white/15 text-white shadow-xl";
const CATALOGUE_SELECT_ITEM =
  "text-white/90 focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white";

function ParserBadge({ status }: { status: ParserStatus }) {
  return (
    <span
      className={`catalogue-status-chip inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${PARSER_COLORS[status]}`}
    >
      {status}
    </span>
  );
}

function RealDataBadge({ status }: { status: RealDataStatus }) {
  return (
    <span
      className={`catalogue-status-chip inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${REAL_DATA_COLORS[status]}`}
    >
      {status === "active" ? "real data" : status}
    </span>
  );
}

function GeoQualityBadge({ quality }: { quality: GeometryQuality }) {
  return (
    <span
      className={`catalogue-status-chip inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${GEO_QUALITY_COLORS[quality]}`}
    >
      {quality}
    </span>
  );
}

function DataTypeBadge({ type }: { type: DataType }) {
  return (
    <span
      className={`catalogue-status-chip inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize text-white ${DATA_TYPE_COLORS[type]}`}
    >
      {type}
    </span>
  );
}

// ─── Summary stat card ────────────────────────────────────────────────────────

function StatCard({ value, label, sub }: { value: string | number; label: string; sub: string }) {
  return (
    <GlassCard className="px-5 py-4 flex flex-col gap-1">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-[13px] font-medium text-white/80">{label}</span>
      <span className="text-[11px] text-white/40">{sub}</span>
    </GlassCard>
  );
}

// ─── Expandable dataset row ───────────────────────────────────────────────────

function DatasetRow({ dataset }: { dataset: DatasetMetadata }) {
  const [open, setOpen] = useState(false);
  const kpiNames = dataset.linkedKpis
    .map((id) => ELABORATOR_KPIS.find((k) => k.id === id)?.shortName ?? id)
    .join(", ");

  return (
    <>
      <TableRow
        className="cursor-pointer border-white/5 group hover:!bg-white/[0.06] data-[state=selected]:!bg-white/[0.06]"
        onClick={() => setOpen((v) => !v)}
      >
        <TableCell className="py-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${CITY_DOT[dataset.city] ?? "bg-white/30"}`} />
            <span className="text-[12px] font-medium text-white/80">{dataset.city}</span>
          </div>
        </TableCell>
        <TableCell className="py-3 max-w-[220px]">
          <p className="text-[12px] font-medium text-white leading-snug">{dataset.title}</p>
        </TableCell>
        <TableCell className="py-3 text-white">
          <DataTypeBadge type={dataset.dataType} />
        </TableCell>
        <TableCell className="py-3">
          <GeoQualityBadge quality={dataset.geometryQuality} />
        </TableCell>
        <TableCell className="py-3">
          <span className="text-[11px] text-white/50 font-mono uppercase">{dataset.geometryType}</span>
        </TableCell>
        <TableCell className="py-3">
          <span className="text-[11px] text-white/60 leading-snug">{kpiNames}</span>
        </TableCell>
        <TableCell className="py-3">
          <span
            className={`catalogue-status-chip inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              dataset.beforeAfterStatus === "both"
                ? "bg-emerald-500/30 text-emerald-50 border-emerald-400/50"
                : dataset.beforeAfterStatus === "before-only" || dataset.beforeAfterStatus === "after-only"
                  ? "bg-amber-500/30 text-amber-50 border-amber-400/50"
                  : "bg-white/10 text-white/75 border-white/25"
            }`}
          >
            {dataset.beforeAfterStatus}
          </span>
        </TableCell>
        <TableCell className="py-3">
          <ParserBadge status={dataset.parserStatus} />
        </TableCell>
        <TableCell className="py-3">
          <RealDataBadge status={dataset.realDataStatus} />
        </TableCell>
        <TableCell className="py-3 text-center">
          <span className="text-white/30 group-hover:text-white/60 transition-colors">
            {open ? <ChevronUp className="h-3.5 w-3.5 inline" /> : <ChevronDown className="h-3.5 w-3.5 inline" />}
          </span>
        </TableCell>
      </TableRow>

      <AnimatePresence>
        {open && (
          <TableRow className="border-white/5 bg-white/[0.02]">
            <TableCell colSpan={10} className="py-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px]">
                  <div>
                    <p className="text-white/40 mb-1 uppercase tracking-wide text-[10px]">Source</p>
                    <p className="text-white/75 break-words">{dataset.source}</p>
                  </div>
                  <div>
                    <p className="text-white/40 mb-1 uppercase tracking-wide text-[10px]">Temporal coverage</p>
                    <p className="text-white/75">{dataset.temporalCoverage}</p>
                  </div>
                  <div>
                    <p className="text-white/40 mb-1 uppercase tracking-wide text-[10px]">Spatial linkage</p>
                    <p className="text-white/75">{dataset.spatialLinkageMethod}</p>
                  </div>
                  <div>
                    <p className="text-white/40 mb-1 uppercase tracking-wide text-[10px]">Update cycle</p>
                    <p className="text-white/75">{dataset.updateStatus}</p>
                  </div>
                  <div>
                    <p className="text-white/40 mb-1 uppercase tracking-wide text-[10px]">File format</p>
                    <p className="text-white/75 uppercase font-mono">{dataset.fileFormat}</p>
                  </div>
                  <div>
                    <p className="text-white/40 mb-1 uppercase tracking-wide text-[10px]">Responsible partner</p>
                    <p className="text-white/75">{dataset.responsiblePartner ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-white/40 mb-1 uppercase tracking-wide text-[10px]">Linked pilots</p>
                    <p className="text-white/75 font-mono">{dataset.pilotIds.join(", ")}</p>
                  </div>
                  {dataset.notes && (
                    <div className="md:col-span-1">
                      <p className="text-white/40 mb-1 uppercase tracking-wide text-[10px]">Notes</p>
                      <p className="text-white/65 leading-relaxed">{dataset.notes}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── KPI Readiness Matrix ─────────────────────────────────────────────────────

function ReadinessMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 text-white/40 font-medium w-40">City</th>
            {ELABORATOR_KPIS.map((kpi) => (
              <th key={kpi.id} className="text-center py-2 px-2 text-white/50 font-medium min-w-[90px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">{kpi.shortName}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p className="font-semibold">{kpi.ref} — {kpi.name}</p>
                    <p className="mt-0.5 text-white/70">{kpi.question}</p>
                  </TooltipContent>
                </Tooltip>
              </th>
            ))}
            <th className="text-right py-2 pl-4 text-white/40 font-medium">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {ALL_CITIES.map((city) => {
            const summary = getCityReadinessSummary(city);
            const coveragePct = Math.round(
              ((summary.ready + summary.partial * 0.5) / summary.total) * 100
            );
            return (
              <tr key={city} className="border-t border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${CITY_DOT[city] ?? "bg-white/30"}`} />
                    <span className="text-white/80 font-medium whitespace-nowrap">{city}</span>
                  </div>
                </td>
                {ELABORATOR_KPIS.map((kpi) => {
                  const cell = KPI_READINESS_MATRIX.find(
                    (c) => c.city === city && c.kpiId === kpi.id
                  );
                  if (!cell) return <td key={kpi.id} />;
                  return (
                    <td key={kpi.id} className="py-3 px-2 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`catalogue-status-chip inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1 cursor-default font-semibold ${READINESS_COLORS[cell.readiness]}`}
                          >
                            {READINESS_ICON[cell.readiness]}
                            <span className="capitalize">{cell.readiness}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          <p className="font-semibold mb-1">{city} / {kpi.ref}</p>
                          <p className="text-white/70">{cell.notes}</p>
                          {cell.datasetCount > 0 && (
                            <p className="mt-1 text-white/50">{cell.datasetCount} dataset{cell.datasetCount !== 1 ? "s" : ""} linked</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
                <td className="py-3 pl-4 text-right">
                  <div className="inline-flex flex-col items-end gap-1">
                    <span className="text-white/70 font-semibold">{coveragePct}%</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: summary.total }).map((_, i) => {
                        const cells = KPI_READINESS_MATRIX.filter((c) => c.city === city);
                        const r = cells[i]?.readiness ?? "missing";
                        return (
                          <span
                            key={i}
                            className={`inline-block h-1.5 w-1.5 rounded-full ${
                              r === "ready" ? "bg-emerald-400" : r === "partial" ? "bg-amber-400" : "bg-white/12"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-white/45 border-t border-white/[0.06] pt-3">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Ready — parser active, real data flowing
        </span>
        <span className="flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3 text-amber-400" /> Partial — dataset linked, integration incomplete
        </span>
        <span className="flex items-center gap-1.5">
          <XCircle className="h-3 w-3 text-white/25" /> Missing — no dataset linked yet
        </span>
      </div>
    </div>
  );
}

// ─── Spatial linkage breakdown ────────────────────────────────────────────────

const LINKAGE_LABELS: Record<string, string> = {
  "direct-coordinates": "Direct coordinates",
  "segment-join": "Segment / shapefile join",
  "polygon-assignment": "Polygon assignment",
  "inferred": "Inferred geometry",
  "none": "No geometry",
};

const LINKAGE_COLORS: Record<string, string> = {
  "direct-coordinates": "bg-emerald-500/70",
  "segment-join": "bg-blue-500/70",
  "polygon-assignment": "bg-violet-500/70",
  "inferred": "bg-amber-500/70",
  "none": "bg-white/15",
};

function SpatialLinkageSection() {
  return (
    <div className="space-y-4">
      {ALL_CITIES.map((city) => {
        const datasets = DATASET_REGISTRY.filter((d) => d.city === city);
        const byMethod = datasets.reduce<Record<string, number>>((acc, d) => {
          acc[d.spatialLinkageMethod] = (acc[d.spatialLinkageMethod] ?? 0) + 1;
          return acc;
        }, {});
        const total = datasets.length;

        return (
          <div
            key={city}
            className={`rounded-xl border bg-gradient-to-r to-transparent p-4 ${CITY_ACCENT[city] ?? "border-white/10 from-white/5"}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${CITY_DOT[city] ?? "bg-white/30"}`} />
                <span className="text-[13px] font-semibold text-white">{city}</span>
              </div>
              <span className="text-[11px] text-white/40">{total} dataset{total !== 1 ? "s" : ""}</span>
            </div>

            {/* Proportional bar */}
            <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
              {Object.entries(byMethod).map(([method, count]) => (
                <div
                  key={method}
                  className={`${LINKAGE_COLORS[method] ?? "bg-white/20"} transition-all`}
                  style={{ flex: count }}
                  title={`${LINKAGE_LABELS[method] ?? method}: ${count}`}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(byMethod).map(([method, count]) => (
                <span key={method} className="flex items-center gap-1.5 text-[11px] text-white/65">
                  <span className={`h-2 w-2 rounded-full ${LINKAGE_COLORS[method] ?? "bg-white/20"}`} />
                  {LINKAGE_LABELS[method] ?? method}
                  <span className="text-white/35">({count})</span>
                </span>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-2 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-[11px] text-white/50 leading-relaxed">
        <span className="text-white/65 font-medium">Spatial linkage priority: </span>
        Direct coordinates → Segment join → Polygon assignment → Inferred → None.
        Hex and derived climate fields use matched centroids around the Issy study junction (~280 m influence buffer).
        Datasets without geometry can still feed KPI cards and the observatory panel but cannot render on the map.
        Segment joins need a shared key (segment ID, zone ID) between geometry and value tables.
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterState = {
  city: string;
  kpi: string;
  dataType: string;
  geoQuality: string;
  parserStatus: string;
};

const FILTER_ALL = "all";

function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const set = (key: keyof FilterState) => (val: string) =>
    onChange({ ...filters, [key]: val });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex items-center gap-1.5 text-[11px] text-white/45 mr-1">
        <Filter className="h-3 w-3" />
        Filter
      </div>

      <Select value={filters.city} onValueChange={set("city")}>
        <SelectTrigger className="h-7 w-[148px] text-[11px] bg-white/[0.04] border-white/10 text-white/75">
          <SelectValue placeholder="City" />
        </SelectTrigger>
        <SelectContent className={CATALOGUE_SELECT_CONTENT}>
          <SelectItem value={FILTER_ALL} className={CATALOGUE_SELECT_ITEM}>All cities</SelectItem>
          {ALL_CITIES.map((c) => (
            <SelectItem key={c} value={c} className={CATALOGUE_SELECT_ITEM}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.kpi} onValueChange={set("kpi")}>
        <SelectTrigger className="h-7 w-[148px] text-[11px] bg-white/[0.04] border-white/10 text-white/75">
          <SelectValue placeholder="KPI" />
        </SelectTrigger>
        <SelectContent className={CATALOGUE_SELECT_CONTENT}>
          <SelectItem value={FILTER_ALL} className={CATALOGUE_SELECT_ITEM}>All KPIs</SelectItem>
          {ELABORATOR_KPIS.map((k) => (
            <SelectItem key={k.id} value={k.id} className={CATALOGUE_SELECT_ITEM}>{k.shortName}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.dataType} onValueChange={set("dataType")}>
        <SelectTrigger className="h-7 w-[120px] text-[11px] bg-white/[0.04] border-white/10 text-white/75">
          <SelectValue placeholder="Data type" />
        </SelectTrigger>
        <SelectContent className={CATALOGUE_SELECT_CONTENT}>
          <SelectItem value={FILTER_ALL} className={CATALOGUE_SELECT_ITEM}>All types</SelectItem>
          {(["observed", "derived", "modelled", "mock"] as const).map((t) => (
            <SelectItem key={t} value={t} className={CATALOGUE_SELECT_ITEM}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.geoQuality} onValueChange={set("geoQuality")}>
        <SelectTrigger className="h-7 w-[130px] text-[11px] bg-white/[0.04] border-white/10 text-white/75">
          <SelectValue placeholder="Geometry" />
        </SelectTrigger>
        <SelectContent className={CATALOGUE_SELECT_CONTENT}>
          <SelectItem value={FILTER_ALL} className={CATALOGUE_SELECT_ITEM}>All geometry</SelectItem>
          {(["exact", "matched", "inferred", "missing"] as const).map((q) => (
            <SelectItem key={q} value={q} className={CATALOGUE_SELECT_ITEM}>{q}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.parserStatus} onValueChange={set("parserStatus")}>
        <SelectTrigger className="h-7 w-[120px] text-[11px] bg-white/[0.04] border-white/10 text-white/75">
          <SelectValue placeholder="Parser" />
        </SelectTrigger>
        <SelectContent className={CATALOGUE_SELECT_CONTENT}>
          <SelectItem value={FILTER_ALL} className={CATALOGUE_SELECT_ITEM}>All parsers</SelectItem>
          {(["ready", "partial", "planned", "none"] as const).map((p) => (
            <SelectItem key={p} value={p} className={CATALOGUE_SELECT_ITEM}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {Object.values(filters).some((v) => v !== FILTER_ALL) && (
        <button
          onClick={() =>
            onChange({
              city: FILTER_ALL,
              kpi: FILTER_ALL,
              dataType: FILTER_ALL,
              geoQuality: FILTER_ALL,
              parserStatus: FILTER_ALL,
            })
          }
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── System health ────────────────────────────────────────────────────────────

function SystemHealth() {
  const { data: health, isLoading } = useWorkflowHealth();

  return (
    <div>
      {isLoading && (
        <p className="text-[12px] text-white/40 animate-pulse">Checking APIs and dataset availability…</p>
      )}
      {!isLoading && health && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${REAL_DATA_COLORS.active}`}>
              <CheckCircle2 className="h-3 w-3" />
              {health.totals.working} working
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${REAL_DATA_COLORS.mock}`}>
              <XCircle className="h-3 w-3" />
              {health.totals.notWorking} issues
            </span>
          </div>
          <div className="space-y-2">
            {health.checks.map((check) => (
              <div
                key={check.name}
                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3"
              >
                {check.status === "working" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-white/80">{check.name}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DataCatalogue = () => {
  const [filters, setFilters] = useState<FilterState>({
    city: FILTER_ALL,
    kpi: FILTER_ALL,
    dataType: FILTER_ALL,
    geoQuality: FILTER_ALL,
    parserStatus: FILTER_ALL,
  });

  const { data: sharepointManifest } = useQuery({
    queryKey: ["sharepoint-manifest-full"],
    queryFn: fetchSharepointManifestFull,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => {
    return DATASET_REGISTRY.filter((d) => {
      if (filters.city !== FILTER_ALL && d.city !== filters.city) return false;
      if (filters.kpi !== FILTER_ALL && !d.linkedKpis.includes(filters.kpi)) return false;
      if (filters.dataType !== FILTER_ALL && d.dataType !== filters.dataType) return false;
      if (filters.geoQuality !== FILTER_ALL && d.geometryQuality !== filters.geoQuality) return false;
      if (filters.parserStatus !== FILTER_ALL && d.parserStatus !== filters.parserStatus) return false;
      return true;
    });
  }, [filters]);

  // Summary counts
  const totalDatasets = DATASET_REGISTRY.length;
  const activeDatasets = DATASET_REGISTRY.filter((d) => d.realDataStatus === "active").length;
  const readyParsers = DATASET_REGISTRY.filter((d) => d.parserStatus === "ready").length;
  const withGeometry = DATASET_REGISTRY.filter((d) => d.geometryType !== "none").length;

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(160deg, #0d0d1a 0%, #0f0f22 40%, #0a0a18 100%)",
      }}
    >
      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16 max-w-[1320px]">
            <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="data-catalogue"
          >
          {/* ── Page header ── */}
          <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1.5">Data Catalogue</h1>
              <p className="text-[14px] text-white/45 max-w-xl">
                Transparent metadata for city datasets — sources, geometry quality, KPI linkage,
                parser status, SharePoint June 2026 integration, and per-pilot intervention geometry.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-white/[0.05] border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => {
                const payload = {
                  exportedAt: new Date().toISOString(),
                  datasets: DATASET_REGISTRY,
                  kpiReadiness: KPI_READINESS_MATRIX,
                  sharepointIntegration: {
                    cities: CITY_INTEGRATION_ROWS,
                    kpiSources: KPI_SOURCE_MATRIX,
                    dropPipeline: DROP_PIPELINE_ROWS,
                    manifest: sharepointManifest,
                  },
                  interventionGeometry: {
                    pilots: PILOT_GEOMETRY_ROWS,
                    cityDashboardFirst: CITY_DASHBOARD_FIRST_SUMMARY,
                  },
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], {
                  type: "application/json;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `elab-data-catalogue-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export metadata
            </Button>
          </div>

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <StatCard
              value={totalDatasets}
              label="Datasets registered"
              sub={`across ${ALL_CITIES.length} lighthouse cities`}
            />
            <StatCard value={activeDatasets} label="Active real data" sub="live or static file" />
            <StatCard value={readyParsers} label="Parsers ready" sub="feeding map layers" />
            <StatCard value={withGeometry} label="Spatially linked" sub="point / segment / polygon" />
            <StatCard
              value={`${SHAREPOINT_LIGHTHOUSE_INTEGRATED_COUNT}/6`}
              label="SharePoint lighthouse"
              sub="integrated (Milan external)"
            />
          </div>

          <GlassCard id="sharepoint-integration" className="p-6 mb-6 scroll-mt-24">
            <SectionTitle
              icon={<Database className="h-4 w-4" />}
              title="SharePoint June 2026 — Data Integration Reference"
              sub="Authoritative traceability from drop → extract → parser → map / observatory"
            />
            <SharePointIntegrationSection manifest={sharepointManifest} />
          </GlassCard>

          <GlassCard id="intervention-geometry" className="p-6 mb-6 scroll-mt-24">
            <SectionTitle
              icon={<MapPin className="h-4 w-4" />}
              title="Intervention geometry reference"
              sub="Smallest meaningful monitoring geometry per pilot — grounded in datasets, not Issy defaults"
            />
            <InterventionGeometrySection />
          </GlassCard>

          {/* ── KPI Readiness Matrix ── */}
          <GlassCard className="p-6 mb-6">
            <SectionTitle
              icon={<ActivitySquare className="h-4 w-4" />}
              title="KPI Readiness Matrix"
              sub="Which cities can currently produce each KPI — derived from the dataset registry"
            />
            <ReadinessMatrix />
          </GlassCard>

          {/* ── Issy KPI derivation ── */}
          <GlassCard id="issy-kpi-methodology" className="p-6 mb-6 scroll-mt-24">
            <SectionTitle
              icon={<FileText className="h-4 w-4" />}
              title="Issy-les-Moulineaux — KPI derivation"
              sub="How each ELABORATOR KPI is computed for Issy today: data sources, steps, and formulas"
            />
            <IssyKpiMethodologySection />
          </GlassCard>

          <GlassCard id="city-kpi-methodology" className="p-6 mb-6 scroll-mt-24">
            <SectionTitle
              icon={<FileText className="h-4 w-4" />}
              title="Cross-city KPI explanation standard"
              sub="Meaning, calculation, limitations, and sources per city using a shared Issy-style methodology contract"
            />
            <div className="space-y-5">
              {ALL_CITIES.filter((city) => city !== "Issy-les-Moulineaux").map((city) => (
                <section key={city} className="space-y-2">
                  <h3 className="text-[13px] font-semibold text-white">{city}</h3>
                  <CityKpiMethodologySection city={city} />
                </section>
              ))}
            </div>
          </GlassCard>

          {/* ── Dataset Registry ── */}
          <GlassCard className="p-6 mb-6">
            <SectionTitle
              icon={<Database className="h-4 w-4" />}
              title="Dataset Registry"
              sub="All datasets with source, type, geometry, KPI linkage, and parser status. Click a row to expand."
            />

            <FilterBar filters={filters} onChange={setFilters} />

            <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
              <Table className="[&_tbody_tr]:hover:!bg-transparent">
                <TableHeader>
                  <TableRow className="border-white/[0.07] bg-white/[0.03] hover:!bg-white/[0.03]">
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5 w-36">City</TableHead>
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5">Dataset</TableHead>
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5">Type</TableHead>
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5">Geometry</TableHead>
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5">Shape</TableHead>
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5">KPIs</TableHead>
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5">Before/After</TableHead>
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5">Parser</TableHead>
                    <TableHead className="text-[11px] text-white/45 font-medium py-2.5">Data</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-10 text-center text-[12px] text-white/35"
                      >
                        No datasets match the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => <DatasetRow key={d.id} dataset={d} />)
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="mt-3 text-[11px] text-white/30">
              {filtered.length} of {totalDatasets} datasets shown
            </p>
          </GlassCard>

          {/* ── Spatial Linkage ── */}
          <GlassCard className="p-6 mb-6">
            <SectionTitle
              icon={<MapPin className="h-4 w-4" />}
              title="Spatial Linkage Coverage"
              sub="How each city's datasets connect data values to map geometry"
            />
            <SpatialLinkageSection />
          </GlassCard>

          {/* ── System Health ── */}
          <GlassCard className="p-6 mb-6">
            <SectionTitle
              icon={<GitBranch className="h-4 w-4" />}
              title="System Health"
              sub="Live API reachability and SharePoint file availability"
            />
            <SystemHealth />
          </GlassCard>

          {/* ── Data pipeline note ── */}
          <GlassCard className="p-5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-white/40 flex-shrink-0 mt-0.5" />
              <div className="text-[12px] text-white/50 leading-relaxed space-y-2">
                <p>
                  <span className="text-white/70 font-medium">Issy. </span>
                  Baseline/post zone-flow CSVs live under{" "}
                  <code className="text-white/55">/public/data/issy/</code>. Live traficissy and city
                  APIs power the map and segment observatory. <strong className="text-white/70">
                    OD rows represent only listed zone_in → zone_out directions.
                  </strong>{" "}
                  Reverse or street-level directions are not inferred — see the{" "}
                  <a
                    href="#issy-kpi-methodology"
                    className="text-violet-300 hover:text-violet-200 underline"
                  >
                    Issy KPI derivation
                  </a>{" "}
                  section above or{" "}
                  <code className="text-white/55">docs/ISSY_KPI_METHODOLOGY.md</code> in the
                  repository.
                </p>
                <p>
                  <span className="text-white/70 font-medium">Copenhagen. </span>
                  Per-camera OpenTrafficCam workbooks include machine-readable sensor coordinates,
                  direction labels (<code className="text-white/55">flow</code> column), pre/post
                  count sheets, and per-classification volumes. Map points are real sensors per
                  direction with exact geometry and observed pre/post values. KPI1.2 is marked{" "}
                  <strong className="text-white/70">ready</strong> as a supporting indicator with
                  observed directional mobility counts (not a full city-wide modal share dataset);
                  see{" "}
                  <code className="text-white/55">docs/COPENHAGEN_DATA_AUDIT.md</code>.
                </p>
                <p className="text-white/40">
                  Readiness in the matrix is derived automatically from this registry.
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
};

export default DataCatalogue;
