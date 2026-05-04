import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "@/components/Header";
import { findPilotByIdGlobally } from "@/data/pilotDefinitions";
import { PILOT_SCROLL_STORIES } from "@/data/storyConfig";

function cityLabelFromPilotsKey(key: string): string {
  const labels: Record<string, string> = {
    milan: "Milan",
    copenhagen: "Copenhagen",
    helsinki: "Helsinki",
    "issy-les-moulineaux": "Issy-les-Moulineaux",
    trikala: "Trikala",
    zaragoza: "Zaragoza",
    barcelona: "Barcelona",
  };
  return labels[key] || key.replace(/-/g, " ");
}

function formatKpiHint(id: string) {
  return `KPI ${id.replace(/^kpi/i, "")}`;
}

/**
 * Guided pilot narrative (`/story/:pilotId`).
 * Sticky context panel + improved IntersectionObserver (no Scrollama — keeps vendor bundle unchanged).
 */
export default function StoryPilotPage() {
  const { pilotId = "" } = useParams<{ pilotId: string }>();
  const match = useMemo(() => (pilotId ? findPilotByIdGlobally(pilotId) : null), [pilotId]);
  const steps = PILOT_SCROLL_STORIES[pilotId] ?? [];

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const visibilityRef = useRef<Map<number, number>>(new Map());
  const [active, setActive] = useState(0);

  const recomputeActive = useCallback(() => {
    let bestIdx = 0;
    let bestRat = -1;
    visibilityRef.current.forEach((ratio, idx) => {
      if (ratio > bestRat) {
        bestRat = ratio;
        bestIdx = idx;
      }
    });
    if (bestRat > 0.04) setActive(bestIdx);
  }, []);

  useEffect(() => {
    if (!steps.length) return;

    visibilityRef.current = new Map();
    stepRefs.current = stepRefs.current.slice(0, steps.length);

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = stepRefs.current.indexOf(e.target as HTMLDivElement);
          if (idx < 0) continue;
          const ratio = e.isIntersecting ? e.intersectionRatio : 0;
          visibilityRef.current.set(idx, ratio);
        }
        recomputeActive();
      },
      {
        root: null,
        rootMargin: "-11% 0px -39% 0px",
        threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.85, 1],
      }
    );

    const rafObserve = () => {
      stepRefs.current.forEach((el) => {
        if (el) obs.observe(el);
      });
    };
    requestAnimationFrame(rafObserve);

    return () => obs.disconnect();
  }, [steps, recomputeActive]);

  const scrollToStep = useCallback((i: number) => {
    stepRefs.current[i]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  if (!match && pilotId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-lg mx-auto px-4 py-10">
          <p className="text-sm text-muted-foreground mb-4">Unknown pilot id.</p>
          <Link to="/map" className="text-violet underline">
            Back to Map
          </Link>
        </main>
      </div>
    );
  }

  if (!steps.length && match) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-lg mx-auto px-4 py-10">
          <p className="text-sm text-muted-foreground mb-4">No scroll narrative configured for this pilot yet.</p>
          <Link to="/map" className="text-violet underline">
            Back to Map
          </Link>
        </main>
      </div>
    );
  }

  const cityName = match ? cityLabelFromPilotsKey(String(match.pilotsKey)) : "";
  const pilot = match?.pilot;
  const activeStep = steps[active] ?? steps[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Mobile / tablet sticky context — complements desktop aside */}
      <div className="lg:hidden sticky top-0 z-[45] border-b border-border/80 bg-background/90 backdrop-blur-md shadow-sm px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
              Step {active + 1} · {steps.length}
            </p>
            <p className="text-sm font-semibold text-violet leading-snug line-clamp-2">{activeStep?.title}</p>
            {activeStep?.spotlight && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{activeStep.spotlight}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-1 pt-0.5" aria-label="Story steps">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToStep(i)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === active ? "bg-violet scale-110" : "bg-muted-foreground/35 hover:bg-violet/60"
                }`}
                aria-label={`Go to step ${i + 1}: ${s.title}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 lg:py-10 flex flex-col lg:flex-row gap-8 lg:gap-10">
        <aside className="hidden lg:flex lg:w-[340px] shrink-0 lg:sticky lg:top-24 lg:self-start flex-col gap-4">
          <div
            className="rounded-2xl border border-border bg-gradient-to-br from-violet/20 to-background p-5 shadow-md min-h-[220px] flex flex-col"
            style={{
              backgroundImage: `radial-gradient(circle at 28% 18%, rgba(101,125,245,0.28), transparent 58%)`,
            }}
          >
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pilot story</p>
              <h1 className="text-xl font-bold text-purple mt-1">{pilot?.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{cityName}</p>
              <p className="text-xs mt-3 leading-relaxed text-foreground/85 border-t border-border/60 pt-3">
                {pilot?.title}
              </p>

              <div className="mt-4 rounded-xl border border-violet/25 bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-violet/90 font-semibold mb-1">Now reading</p>
                <p className="text-sm font-semibold text-foreground leading-snug">{activeStep?.title}</p>
                {activeStep?.spotlight && (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-l-2 border-violet/50 pl-2">
                    {activeStep.spotlight}
                  </p>
                )}
              </div>
            </div>
            <Link
              to="/map"
              className="mt-5 inline-flex text-sm font-semibold text-violet hover:underline"
            >
              Open interactive map →
            </Link>
          </div>

          <nav className="rounded-2xl border border-border bg-card/60 p-3 space-y-1.5" aria-label="Story sections">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 mb-1">Jump to section</p>
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToStep(i)}
                className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                  i === active
                    ? "bg-violet/20 text-violet font-semibold border border-violet/30"
                    : "hover:bg-muted/70 text-foreground/90 border border-transparent"
                }`}
              >
                <span className="text-muted-foreground font-normal mr-2">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </button>
            ))}
          </nav>

          <p className="text-[11px] text-muted-foreground px-1">
            Scroll-linked via IntersectionObserver (no extra charting libraries bundled).
          </p>
        </aside>

        <article className="flex-1 min-w-0 space-y-6 lg:space-y-10 pb-28">
          {steps.map((s, i) => (
            <div
              key={s.id}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              data-step-index={i}
              id={`story-step-${s.id}`}
              className={`rounded-2xl border px-5 py-7 lg:px-7 lg:py-9 shadow-sm scroll-mt-36 transition-colors duration-300 ${
                i === active
                  ? "border-violet/45 bg-card ring-1 ring-violet/20"
                  : "border-border bg-card/70"
              }`}
            >
              {s.eyebrow && (
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">{s.eyebrow}</p>
              )}
              <h2 className="text-lg lg:text-xl font-semibold text-violet mb-3">{s.title}</h2>
              <p className="text-sm leading-relaxed text-foreground/90">{s.narrative}</p>
              {Array.isArray(s.bullets) && s.bullets.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-foreground/85 list-disc pl-5 marker:text-violet">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {Array.isArray(s.kpiHints) && s.kpiHints.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {s.kpiHints.map((k) => (
                    <span
                      key={k}
                      className="text-[10px] px-2 py-1 rounded-full bg-muted/80 border border-border text-muted-foreground font-medium"
                    >
                      {formatKpiHint(k)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="pt-4 border-t border-border/60">
            <Link to="/map" className="inline-flex items-center gap-2 text-sm font-semibold text-violet hover:underline">
              Finish — return to map
              <span aria-hidden>→</span>
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
