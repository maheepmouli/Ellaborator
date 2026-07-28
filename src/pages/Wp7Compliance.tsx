import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Info,
  XCircle,
} from "lucide-react";
import Header from "@/components/Header";
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
import { ALL_CITIES } from "@/data/datasetMetadata";
import { ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { getAllWp7Datasets, getWp7DatasetById } from "@/data/wp7/adaptDataset";
import type { Wp7ComplianceStatus, Wp7DatasetRecord } from "@/data/wp7/wp7Types";
import {
  getCityComplianceSummary,
  getCityKpiMatrix,
  KPI_EVIDENCE_RULE_SUMMARIES,
  WP7_KPI_IDS,
  downloadWp7Package,
  statusLabel,
} from "@/lib/wp7";
import { evaluateDatasetKpiEvidence } from "@/lib/wp7/kpiEvidenceRules";
import { assessDatasetForKpi } from "@/lib/wp7/complianceScorer";

const FILTER_ALL = "all";

const STATUS_COLORS: Record<Wp7ComplianceStatus, string> = {
  ready: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  partial: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  missing: "bg-white/10 text-white/60 border-white/20",
};

const STATUS_ICON: Record<Wp7ComplianceStatus, React.ReactNode> = {
  ready: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  partial: <AlertCircle className="h-3.5 w-3.5 text-amber-400" />,
  missing: <XCircle className="h-3.5 w-3.5 text-white/35" />,
};

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white/[0.04] backdrop-blur-sm ${className}`}
      style={{ borderColor: "rgba(255,255,255,0.10)" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="mt-0.5 rounded-lg bg-white/[0.06] border border-white/10 p-2 text-white/70">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {sub ? <p className="text-[13px] text-white/45 mt-0.5">{sub}</p> : null}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: Wp7ComplianceStatus }) {
  return (
    <Badge variant="outline" className={`gap-1 ${STATUS_COLORS[status]}`}>
      {STATUS_ICON[status]}
      {statusLabel(status)}
    </Badge>
  );
}

function kpiShort(id: string) {
  return ELABORATOR_KPIS.find((k) => k.id === id)?.ref ?? id;
}

export default function Wp7Compliance() {
  const [cityFilter, setCityFilter] = useState<string>(FILTER_ALL);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<string>("kpi4.1");

  const matrix = useMemo(
    () =>
      getCityKpiMatrix(
        cityFilter === FILTER_ALL ? undefined : cityFilter
      ),
    [cityFilter]
  );

  const datasets = useMemo(() => {
    const all = getAllWp7Datasets();
    return cityFilter === FILTER_ALL
      ? all
      : all.filter((d) => d.city === cityFilter);
  }, [cityFilter]);

  const selectedDataset: Wp7DatasetRecord | undefined = selectedDatasetId
    ? getWp7DatasetById(selectedDatasetId)
    : datasets[0];

  const datasetAssessment = selectedDataset
    ? assessDatasetForKpi(selectedDataset, selectedKpi)
    : null;

  const evidenceChecks = selectedDataset
    ? evaluateDatasetKpiEvidence(selectedDataset, selectedKpi)
    : [];

  const summaries = ALL_CITIES.map((city) => ({
    city,
    ...getCityComplianceSummary(city),
  }));

  const exportPreview = useMemo(() => {
    const city = cityFilter === FILTER_ALL ? undefined : cityFilter;
    return {
      files: [
        "manifest.json — city summaries + KPI scores",
        "datasets/*.json — Wp7DatasetRecord metadata (no PII)",
        "kpi-evidence-summary.csv — one row per city×KPI",
        "readme.txt — cheat-sheet gaps still needed from cities",
      ],
      scope: city ?? "all cities",
      datasetCount: datasets.length,
      matrixRows: matrix.length,
    };
  }, [cityFilter, datasets.length, matrix.length]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #0d0d1a 0%, #0f0f22 40%, #0a0a18 100%)",
      }}
    >
      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16 max-w-[1320px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1.5">
                WP7 Compliance
              </h1>
              <p className="text-[14px] text-white/45 max-w-2xl">
                Submission-assist layer against the WP7 City Data Specification
                (FINAL Jan 2026). Tracks underlying data + metadata completeness —
                cities do not calculate KPIs here.{" "}
                <Link
                  to="/data-catalogue"
                  className="text-sky-300/90 hover:underline"
                >
                  Data Catalogue
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-white/[0.05] border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() =>
                  downloadWp7Package(
                    cityFilter === FILTER_ALL ? undefined : cityFilter
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Export WP7 package
              </Button>
            </div>
          </div>

          {/* City summaries */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {summaries.map((s) => (
              <button
                key={s.city}
                type="button"
                onClick={() =>
                  setCityFilter(cityFilter === s.city ? FILTER_ALL : s.city)
                }
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  cityFilter === s.city
                    ? "border-teal-400/50 bg-teal-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="text-[11px] text-white/50 truncate">{s.city}</div>
                <div className="mt-1 flex gap-2 text-[11px]">
                  <span className="text-emerald-300">{s.ready}R</span>
                  <span className="text-amber-300">{s.partial}P</span>
                  <span className="text-white/40">{s.missing}M</span>
                </div>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <Filter className="h-4 w-4 text-white/40" />
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[220px] bg-white/[0.05] border-white/15 text-white/80">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All cities</SelectItem>
                {ALL_CITIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedKpi} onValueChange={setSelectedKpi}>
              <SelectTrigger className="w-[220px] bg-white/[0.05] border-white/15 text-white/80">
                <SelectValue placeholder="KPI" />
              </SelectTrigger>
              <SelectContent>
                {WP7_KPI_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {kpiShort(id)} —{" "}
                    {ELABORATOR_KPIS.find((k) => k.id === id)?.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 1. City × KPI matrix */}
          <GlassCard className="p-5 mb-8">
            <SectionTitle
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="City × KPI matrix"
              sub="Ready = evidence + required metadata. Partial = incomplete or wrong proxy. Missing = no linked evidence of the right type."
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">City</TableHead>
                    {WP7_KPI_IDS.map((id) => (
                      <TableHead key={id} className="text-white/50 text-center">
                        {kpiShort(id)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_CITIES.filter(
                    (c) => cityFilter === FILTER_ALL || c === cityFilter
                  ).map((city) => (
                    <TableRow key={city} className="border-white/10">
                      <TableCell className="text-white/80 font-medium text-sm">
                        {city}
                      </TableCell>
                      {WP7_KPI_IDS.map((kpiId) => {
                        const cell = matrix.find(
                          (m) => m.city === city && m.kpiId === kpiId
                        );
                        const status = cell?.status ?? "missing";
                        return (
                          <TableCell key={kpiId} className="text-center">
                            <button
                              type="button"
                              className="inline-flex"
                              title={cell?.notes?.join("\n") || statusLabel(status)}
                              onClick={() => {
                                setSelectedKpi(kpiId);
                                if (cell?.datasetIds[0]) {
                                  setSelectedDatasetId(cell.datasetIds[0]);
                                }
                              }}
                            >
                              <StatusChip status={status} />
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* 2. Dataset detail */}
            <GlassCard className="p-5">
              <SectionTitle
                icon={<FileText className="h-4 w-4" />}
                title="Dataset compliance detail"
                sub="Universal metadata checklist for the selected dataset."
              />
              <Select
                value={selectedDataset?.id ?? ""}
                onValueChange={setSelectedDatasetId}
              >
                <SelectTrigger className="mb-4 bg-white/[0.05] border-white/15 text-white/80">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.city} — {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedDataset ? (
                <div className="space-y-3 text-[13px]">
                  <div className="flex flex-wrap gap-2">
                    {selectedDataset.linkedKpis.map((k) => (
                      <Badge
                        key={k}
                        variant="outline"
                        className="border-white/20 text-white/70"
                      >
                        {kpiShort(k)}
                      </Badge>
                    ))}
                    {selectedDataset.wrongProxyForKpis.map((k) => (
                      <Badge
                        key={`w-${k}`}
                        variant="outline"
                        className="border-amber-400/40 text-amber-100/80"
                      >
                        wrong proxy {kpiShort(k)}
                      </Badge>
                    ))}
                  </div>
                  <dl className="grid grid-cols-1 gap-2 text-white/70">
                    <div>
                      <dt className="text-white/40 text-[11px]">Data source</dt>
                      <dd>{selectedDataset.universal.dataSource || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-white/40 text-[11px]">Method</dt>
                      <dd>
                        {selectedDataset.universal.collectionMethodCategory} —{" "}
                        {selectedDataset.universal.methodDescription || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/40 text-[11px]">GDPR / access</dt>
                      <dd>
                        {selectedDataset.universal.gdprStatus}
                        {selectedDataset.universal.accessRights
                          ? ` · ${selectedDataset.universal.accessRights}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/40 text-[11px]">
                        Missing universal fields
                      </dt>
                      <dd>
                        {selectedDataset.missingUniversalFields.length === 0 ? (
                          <span className="text-emerald-300/90">None blocking</span>
                        ) : (
                          <span className="text-amber-200/90">
                            {selectedDataset.missingUniversalFields.join(", ")}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-white/40 text-sm">No dataset selected.</p>
              )}
            </GlassCard>

            {/* 3. KPI evidence checklist */}
            <GlassCard className="p-5">
              <SectionTitle
                icon={<Info className="h-4 w-4" />}
                title="KPI evidence checklist"
                sub={
                  KPI_EVIDENCE_RULE_SUMMARIES.find((r) => r.kpiId === selectedKpi)
                    ?.notes
                }
              />
              {datasetAssessment ? (
                <div className="mb-4 flex items-center gap-2">
                  <StatusChip status={datasetAssessment.status} />
                  <span className="text-[12px] text-white/50">
                    {selectedDataset?.id} × {kpiShort(selectedKpi)}
                  </span>
                </div>
              ) : null}
              <ul className="space-y-2">
                {evidenceChecks.map((c) => (
                  <li
                    key={c.field}
                    className="flex items-start gap-2 text-[13px] text-white/75"
                  >
                    {c.present ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          c.required ? "text-rose-400" : "text-white/30"
                        }`}
                      />
                    )}
                    <span>
                      <span className="text-white/90">{c.field}</span>
                      {c.required ? (
                        <span className="text-white/35"> · required</span>
                      ) : (
                        <span className="text-white/35"> · preferred</span>
                      )}
                      {c.detail ? (
                        <span className="block text-[11px] text-white/40">
                          {c.detail}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {datasetAssessment?.notes?.length ? (
                <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/85 space-y-1">
                  {datasetAssessment.notes.map((n) => (
                    <p key={n}>{n}</p>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 pt-4 border-t border-white/10">
                <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wide">
                  Cheat-sheet expectations
                </p>
                <ul className="space-y-1 text-[12px] text-white/55">
                  {KPI_EVIDENCE_RULE_SUMMARIES.find(
                    (r) => r.kpiId === selectedKpi
                  )?.requiredEvidence.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            </GlassCard>
          </div>

          {/* 4. Export preview */}
          <GlassCard className="p-5">
            <SectionTitle
              icon={<Download className="h-4 w-4" />}
              title="Submission package preview"
              sub="Export is submission-assist — not a claim that WP7 calculation is finished."
            />
            <div className="grid md:grid-cols-2 gap-4 text-[13px] text-white/70">
              <div>
                <p className="text-white/40 text-[11px] mb-1">Scope</p>
                <p>
                  {exportPreview.scope} · {exportPreview.datasetCount} datasets ·{" "}
                  {exportPreview.matrixRows} city×KPI rows
                </p>
              </div>
              <ul className="space-y-1">
                {exportPreview.files.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </div>
            <Button
              className="mt-4 gap-2"
              size="sm"
              onClick={() =>
                downloadWp7Package(
                  cityFilter === FILTER_ALL ? undefined : cityFilter
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Download package + CSV
            </Button>
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
}
