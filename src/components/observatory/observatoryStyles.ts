export const OBS_C = {
  cyan: "#63ccff",
  lime: "#b0edba",
  violet: "#657df5",
  lavender: "#8578c3",
  amber: "#f59e0b",
  rose: "#f43f5e",
  muted: "rgba(255,255,255,0.40)",
  panel: "rgba(8,7,22,0.97)",
  schematicBg: "#131a30",
  glass: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.11)",
};

export const MODE_COLORS: Record<string, string> = {
  Pedestrian: OBS_C.lime,
  Cycle: OBS_C.cyan,
  "Public Transport": OBS_C.violet,
  Car: OBS_C.lavender,
  PTW: "#a78bfa",
  bike: OBS_C.cyan,
  pedestrian: OBS_C.lime,
  motorised: OBS_C.lavender,
  ptw: "#a78bfa",
};

/** Tailwind opacity steps that exist in the build (avoid /72, /88, etc.). */
export const obsTextHeading = "text-white/90";
export const obsTextBody = "text-white/75";
export const obsTextMuted = "text-white/65";
export const obsTextCaption = "text-white/55";

export function obsGlassCardClass(compact?: boolean): string {
  return `rounded-xl border text-white ${compact ? "px-3 py-2" : "px-4 py-3"}`;
}

export function obsGlassCardStyle(glow?: string): React.CSSProperties {
  return {
    background: OBS_C.glass,
    borderColor: OBS_C.border,
    boxShadow: glow ? `0 0 18px ${glow}` : undefined,
  };
}
