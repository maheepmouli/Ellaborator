import { useEffect, useState } from "react";
import { ExternalLink, FileSpreadsheet, AlertTriangle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  loadIssyCatalogueSnapshot,
  statusBadgeClass,
  type IssyCatalogueSnapshot,
} from "@/data/issyCatalogueSnapshot";

function IntegrationBadge({ status }: { status: string }) {
  const cls =
    status === "integrated"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "catalogued"
        ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
        : "bg-white/5 text-white/50 border-white/10";
  return (
    <Badge variant="outline" className={`text-[10px] font-medium ${cls}`}>
      {status}
    </Badge>
  );
}

export function IssyCatalogueSection() {
  const [snapshot, setSnapshot] = useState<IssyCatalogueSnapshot | null>(null);

  useEffect(() => {
    void loadIssyCatalogueSnapshot().then(setSnapshot);
  }, []);

  if (!snapshot) {
    return (
      <p className="text-[12px] text-white/45">
        Run <code className="text-white/55">npm run extract-sharepoint</code> and{" "}
        <code className="text-white/55">npm run build-issy-catalogue</code> to generate the Issy file
        inventory.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-[11px] text-white/55 leading-relaxed">
        June 2026 drop: {snapshot.zipFileCount} files in zip, {snapshot.extractedFileCount}{" "}
        catalogued in mirror. Generated {new Date(snapshot.generatedAt).toLocaleString()}.
      </p>

      {snapshot.kpi31ZeroEmission && (
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/8 p-4">
          <p className="text-[11px] font-semibold text-violet-200/95 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            KPI 3.1 — Zero-emission facilities &amp; services
          </p>
          <p className="mt-2 text-[11px] text-white/65 leading-relaxed">
            {snapshot.kpi31ZeroEmission.notes}
          </p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-[10px]">
            <div>
              <dt className="text-white/40">SharePoint file</dt>
              <dd className="text-white/75">
                {snapshot.kpi31ZeroEmission.sharePointFile ? "Yes" : "None in zip"}
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Requirements matrix</dt>
              <dd className="text-white/75">{snapshot.kpi31ZeroEmission.requirementsStatus}</dd>
            </div>
            <div>
              <dt className="text-white/40">Runtime source</dt>
              <dd className="text-white/75 font-mono">{snapshot.kpi31ZeroEmission.runtimeSource}</dd>
            </div>
            <div>
              <dt className="text-white/40">Primary pilot</dt>
              <dd className="text-white/75">{snapshot.kpi31ZeroEmission.primaryPilot}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.07] bg-white/[0.03] hover:!bg-white/[0.03]">
              <TableHead className="text-[11px] text-white/45">File</TableHead>
              <TableHead className="text-[11px] text-white/45">Sheets</TableHead>
              <TableHead className="text-[11px] text-white/45">Pilots</TableHead>
              <TableHead className="text-[11px] text-white/45">KPIs</TableHead>
              <TableHead className="text-[11px] text-white/45">Status</TableHead>
              <TableHead className="text-[11px] text-white/45 w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.files.map((file) => (
              <TableRow key={file.id} className="border-white/[0.05] hover:bg-white/[0.02]">
                <TableCell className="py-2.5 align-top">
                  <p className="text-[12px] font-medium text-white/88">{file.title}</p>
                  <p className="mt-0.5 text-[10px] text-white/40 font-mono">{file.format}</p>
                  {file.notes && (
                    <p className="mt-1 text-[10px] text-white/50 leading-relaxed max-w-md">
                      {file.notes}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-[11px] text-white/60 align-top">
                  {file.sheets.length > 0 ? (
                    <ul className="list-disc pl-3 space-y-0.5">
                      {file.sheets.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-[10px] text-white/55 align-top">
                  {file.pilotIds.join(", ")}
                </TableCell>
                <TableCell className="text-[10px] text-white/55 align-top">
                  {file.linkedKpis.length ? file.linkedKpis.join(", ") : "—"}
                </TableCell>
                <TableCell className="align-top">
                  <IntegrationBadge status={file.integrationStatus} />
                </TableCell>
                <TableCell className="align-top">
                  {file.publicPath ? (
                    <a
                      href={file.publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#96c2ef] hover:text-white"
                      title="Open from SharePoint mirror"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-[10px] text-white/35" title="Live API — no file link">
                      API
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-white/80 flex items-center gap-1.5 mb-2">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Data readiness matrix (from requirements xlsx)
        </p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] bg-white/[0.03]">
                <TableHead className="text-[10px] text-white/45">KPI / data</TableHead>
                <TableHead className="text-[10px] text-white/45">Pilot 1</TableHead>
                <TableHead className="text-[10px] text-white/45">Pilot 2</TableHead>
                <TableHead className="text-[10px] text-white/45">Pilot 3</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.dataReadinessMatrix.map((row, i) => (
                <TableRow key={`${row.kpi}-${row.dataRequired}-${i}`} className="border-white/[0.05]">
                  <TableCell className="py-2 align-top">
                    <p className="text-[10px] text-white/40">{row.theme}</p>
                    <p className="text-[11px] text-white/75">{row.dataRequired}</p>
                  </TableCell>
                  <TableCell className="align-top text-[10px]">
                    {row.pilot1Data && row.pilot1Data !== "NA" ? (
                      <>
                        <p className="text-white/60 whitespace-pre-wrap">{row.pilot1Data}</p>
                        {row.pilot1Status && (
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[9px] ${statusBadgeClass(row.pilot1Status)}`}
                          >
                            {row.pilot1Status}
                          </Badge>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="align-top text-[10px]">
                    {row.pilot2Data && row.pilot2Data !== "NA" ? (
                      <>
                        <p className="text-white/60">{row.pilot2Data}</p>
                        {row.pilot2Status && (
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[9px] ${statusBadgeClass(row.pilot2Status)}`}
                          >
                            {row.pilot2Status}
                          </Badge>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="align-top text-[10px]">
                    {row.pilot3Data && row.pilot3Data !== "NA" ? (
                      <>
                        <p className="text-white/60 whitespace-pre-wrap">{row.pilot3Data}</p>
                        {row.pilot3Status && (
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[9px] ${statusBadgeClass(row.pilot3Status)}`}
                          >
                            {row.pilot3Status}
                          </Badge>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {snapshot.gaps.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[11px] font-medium text-amber-200/90 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Known gaps in June 2026 drop
          </p>
          <ul className="mt-2 list-disc pl-4 text-[11px] text-white/60 space-y-1">
            {snapshot.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
