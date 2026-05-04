import { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";
import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { kmBufferAround } from "@/lib/turfKmBuffer";

/**
 * Spike: Observable Plot + Turf in Vite bundle (sandbox — not linked from primary nav).
 * Bundle impact is accounted for alongside deck.gl; KPICharts migrates Plot after patterns land.
 */
export default function PlotSpike() {
  const chartRef = useRef<HTMLDivElement>(null);
  const turfNoteRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const sample = [
      { day: "Mon", share: 32 },
      { day: "Tue", share: 35 },
      { day: "Wed", share: 38 },
      { day: "Thu", share: 40 },
      { day: "Fri", share: 42 },
    ];
    el.replaceChildren();
    const chart = Plot.plot({
      marks: [
        Plot.line(sample, {
          x: "day",
          y: "share",
          stroke: "#657DF5",
          strokeWidth: 2,
        }),
        Plot.dot(sample, {
          x: "day",
          y: "share",
          fill: "#2F1B6D",
          r: 5,
        }),
        Plot.ruleY([0]),
      ],
      x: { label: "Day", tickRotate: 0 },
      y: { label: "Illustrative %", grid: true },
      style: {
        fontFamily: "'DM Sans', system-ui, sans-serif",
      },
      marginLeft: 50,
      width: Math.min(el.clientWidth || 560, 640),
      height: 260,
      className: "plot-spike",
    });
    el.append(chart);
    return () => chart.remove();
  }, []);

  useEffect(() => {
    const geo = kmBufferAround(9.19, 45.4642, 2);
    if (turfNoteRef.current) {
      turfNoteRef.current.textContent =
        typeof geo === "object" && geo && "type" in geo
          ? `Turf spike: GeoJSON "${geo.type}" (2km buffer around Milan centroid).`
          : "Turf buffer computed.";
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-8 space-y-4">
        <p className="text-sm text-muted-foreground">
          <Link to="/map" className="text-violet underline">
            Back to Map
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-foreground">Visualization spikes</h1>
        <p ref={turfNoteRef} className="text-sm text-muted-foreground min-h-[1.25rem]" />
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Observable Plot sample</h2>
          <div ref={chartRef} className="overflow-x-auto" />
          <p className="mt-3 text-xs text-muted-foreground">
            Sample line chart only — KPI migration uses CITY_DATA-aligned series from components like KPICharts next.
          </p>
        </section>
      </main>
    </div>
  );
}
