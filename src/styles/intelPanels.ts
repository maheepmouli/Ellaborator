/** Shared typography + shell classes for InsightPanel and SegmentIntelligencePanel. */
export const intelPanelShell =
  "bg-[linear-gradient(165deg,rgba(22,18,48,0.94)_0%,rgba(12,10,32,0.98)_100%)] border border-white/35 rounded-2xl text-white leading-intel tracking-intel";

export const intelPanelHeader =
  "bg-gradient-to-br from-violet/90 to-violet/70 px-5 pt-5 pb-4";

export const intelSectionLabel =
  "text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/75";

export const intelBodyPrimary = "text-white/85";
export const intelBodySecondary = "text-white/55";
export const intelBodyMeta = "text-white/40";

/** KPI numbers and emphasis on dark glass — avoid violet body text. */
export const intelAccentValue = "text-cyan-200 font-bold tabular-nums";
export const intelAccentLabel = "text-white/90 font-semibold";

export const intelChipStyle = {
  borderColor: "rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.88)",
} as const;
