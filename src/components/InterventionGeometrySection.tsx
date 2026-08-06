import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CITY_DASHBOARD_FIRST_SUMMARY,
  ELABORATOR_SPATIAL_STANDARD,
  GEOMETRY_FINAL_RECOMMENDATION,
  PILOT_GEOMETRY_ROWS,
  type DashboardFirstMode,
  type GeometryConfidence,
} from "@/data/interventionGeometryAudit";
import { useZaragozaUnlocked } from "@/hooks/useZaragozaUnlocked";
import { isZaragozaCityName } from "@/lib/zaragozaAccess";

const MODE_COLORS: Record<DashboardFirstMode, string> = {
  "corridor-first": "bg-violet-500/30 text-violet-50 border-violet-400/50",
  "camera-first": "bg-blue-500/30 text-blue-50 border-blue-400/50",
  "segment-first": "bg-amber-500/30 text-amber-50 border-amber-400/50",
  "area-first": "bg-rose-500/30 text-rose-50 border-rose-400/50",
  "point-first": "bg-teal-500/30 text-teal-50 border-teal-400/50",
  "network-first": "bg-sky-500/30 text-sky-50 border-sky-400/50",
};

const CONFIDENCE_COLORS: Record<GeometryConfidence, string> = {
  high: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  medium: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  low: "bg-rose-500/30 text-rose-50 border-rose-400/50",
};

function Chip({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`catalogue-status-chip inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

export function InterventionGeometrySection() {
  const { unlocked: zaragozaUnlocked } = useZaragozaUnlocked();
  const citySummary = zaragozaUnlocked
    ? CITY_DASHBOARD_FIRST_SUMMARY
    : CITY_DASHBOARD_FIRST_SUMMARY.filter((row) => !isZaragozaCityName(row.city));
  const pilotRows = zaragozaUnlocked
    ? PILOT_GEOMETRY_ROWS
    : PILOT_GEOMETRY_ROWS.filter((row) => !isZaragozaCityName(row.city));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[12px] font-semibold text-white/80 mb-2">ELABORATOR spatial standard</p>
        <ul className="list-disc pl-4 space-y-1">
          {ELABORATOR_SPATIAL_STANDARD.map((line) => (
            <li key={line} className="text-[11px] text-white/55 leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-white/75 mb-2">City dashboard-first summary</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] bg-white/[0.03] hover:!bg-white/[0.03]">
                <TableHead className="text-[11px] text-white/45">City</TableHead>
                <TableHead className="text-[11px] text-white/45">Mode</TableHead>
                <TableHead className="text-[11px] text-white/45">User should understand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {citySummary.map((row) => (
                <TableRow key={row.city} className="border-white/5">
                  <TableCell className="text-[12px] text-white/85 font-medium">{row.city}</TableCell>
                  <TableCell>
                    <Chip label={row.mode} className={MODE_COLORS[row.mode]} />
                  </TableCell>
                  <TableCell className="text-[11px] text-white/55">{row.userUnderstanding}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-white/75 mb-2">Per-pilot intervention geometry</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] bg-white/[0.03] hover:!bg-white/[0.03]">
                <TableHead className="text-[11px] text-white/45">City</TableHead>
                <TableHead className="text-[11px] text-white/45">Pilot</TableHead>
                <TableHead className="text-[11px] text-white/45">Intervention</TableHead>
                <TableHead className="text-[11px] text-white/45">Geometry</TableHead>
                <TableHead className="text-[11px] text-white/45">Available today</TableHead>
                <TableHead className="text-[11px] text-white/45">Recommended dashboard</TableHead>
                <TableHead className="text-[11px] text-white/45">Mode</TableHead>
                <TableHead className="text-[11px] text-white/45">Conf.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pilotRows.map((row) => (
                <TableRow key={row.pilotId} className="border-white/5 align-top">
                  <TableCell className="text-[11px] text-white/80 font-medium">{row.city}</TableCell>
                  <TableCell className="text-[11px] text-white/70">{row.pilotLabel}</TableCell>
                  <TableCell className="text-[11px] text-white/70 max-w-[140px]">{row.intervention}</TableCell>
                  <TableCell className="text-[11px] text-white/60">{row.geometryType}</TableCell>
                  <TableCell className="text-[10px] text-white/45 max-w-[180px]">{row.geometryAvailable}</TableCell>
                  <TableCell className="text-[10px] text-white/55 max-w-[180px]">{row.recommendedDashboard}</TableCell>
                  <TableCell>
                    <Chip label={row.dashboardFirstMode} className={MODE_COLORS[row.dashboardFirstMode]} />
                  </TableCell>
                  <TableCell>
                    <Chip label={row.confidence} className={CONFIDENCE_COLORS[row.confidence]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-white/75 mb-2">Implementation gaps (current vs recommended)</p>
        <ul className="space-y-2">
          {pilotRows.filter((r) => r.currentImplementationGap).map((row) => (
            <li
              key={`gap-${row.pilotId}`}
              className="rounded-lg border border-amber-400/25 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-100/85"
            >
              <span className="font-semibold text-amber-50">
                {row.city} {row.pilotLabel}:
              </span>{" "}
              {row.currentImplementationGap}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="rounded-xl border px-4 py-3 text-[12px] leading-relaxed"
        style={{ borderColor: "rgba(99,204,255,0.25)", background: "rgba(99,204,255,0.06)" }}
      >
        <p className="font-semibold text-white/85 mb-1">Final recommendation</p>
        <p className="text-white/60">{GEOMETRY_FINAL_RECOMMENDATION}</p>
        <p className="text-[11px] text-white/45 mt-2">
          Dataset provenance: see{" "}
          <a href="#sharepoint-integration" className="text-sky-300/90 hover:text-sky-200">
            SharePoint June 2026 integration reference
          </a>
          .
        </p>
      </div>
    </div>
  );
}
