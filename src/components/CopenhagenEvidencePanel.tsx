import { useEffect, useState } from "react";
import {
  filterEvidenceByPilot,
  loadCopenhagenEvidenceManifest,
  type CopenhagenEvidenceEntry,
} from "@/data/copenhagenEvidenceManifest";
import { FileText, ImageIcon, ExternalLink } from "lucide-react";

interface CopenhagenEvidencePanelProps {
  pilotId?: string | null;
}

function EvidenceBlock({ entry }: { entry: CopenhagenEvidenceEntry }) {
  const [imgError, setImgError] = useState(false);

  if (entry.type === "narrative" || (!entry.path && entry.fallback)) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-[11px] font-medium text-white/90">{entry.title}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">
          {entry.fallback?.text ?? entry.caption ?? "Documentation-only method — no structured dataset in bundle."}
        </p>
        {entry.linkedMethods.length > 0 && (
          <p className="mt-2 text-[10px] text-white/45">
            Methods: {entry.linkedMethods.join(" · ")}
          </p>
        )}
      </div>
    );
  }

  if (entry.type === "image" && entry.path && !imgError) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-[11px] font-medium text-white/90">{entry.title}</p>
        <img
          src={entry.path}
          alt={entry.title}
          loading="lazy"
          className="mt-2 max-h-40 w-full rounded object-cover"
          onError={() => setImgError(true)}
        />
        {entry.caption && (
          <p className="mt-2 text-[10px] leading-relaxed text-white/60">{entry.caption}</p>
        )}
      </div>
    );
  }

  if (entry.type === "pdf" && entry.path) {
    return (
      <a
        href={entry.path}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
      >
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#96c2ef]" />
        <div>
          <p className="text-[11px] font-medium text-white/90">{entry.title}</p>
          {entry.caption && (
            <p className="mt-1 text-[10px] text-white/60">{entry.caption}</p>
          )}
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#96c2ef]">
            Open PDF <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </a>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-white/50" />
        <p className="text-[11px] font-medium text-white/90">{entry.title}</p>
      </div>
      <p className="mt-1.5 text-[11px] text-white/60">
        {entry.fallback?.text ?? "Asset unavailable in committed bundle."}
      </p>
    </div>
  );
}

export function CopenhagenEvidencePanel({ pilotId }: CopenhagenEvidencePanelProps) {
  const [entries, setEntries] = useState<CopenhagenEvidenceEntry[]>([]);

  useEffect(() => {
    void loadCopenhagenEvidenceManifest().then((all) => {
      setEntries(filterEvidenceByPilot(all, pilotId));
    });
  }, [pilotId]);

  if (!entries.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-wide text-white/50">Partner evidence &amp; narrative methods</p>
      <div className="grid gap-2">
        {entries.map((entry) => (
          <EvidenceBlock key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
