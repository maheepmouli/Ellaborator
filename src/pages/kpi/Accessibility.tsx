import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const Accessibility = () => {
  const chartOption = {
    title: {
      text: "Accessibility Features by Type",
      textStyle: { color: "#111111", fontSize: 18, fontWeight: "bold" },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: "#111111" },
    },
    yAxis: {
      type: "category",
      data: [
        "Tactile Paving",
        "Curb Ramps",
        "Audio Signals",
        "Wide Sidewalks",
        "Resting Benches",
        "Accessible Parking",
      ],
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "Count",
        type: "bar",
        data: [12, 8, 6, 5, 7, 4],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#E02020" },
            { offset: 1, color: "#C31414" },
          ]),
        },
        label: { show: true, position: "right", color: "#111111" },
      },
    ],
  };

  const coverageOption = {
    title: {
      text: "Coverage by District",
      textStyle: { color: "#111111", fontSize: 16 },
    },
    tooltip: { trigger: "item" },
    series: [
      {
        name: "Features",
        type: "pie",
        radius: "65%",
        center: ["50%", "50%"],
        data: [
          { value: 14, name: "Centro Storico", itemStyle: { color: "#E02020" } },
          { value: 11, name: "Porta Venezia", itemStyle: { color: "#C31414" } },
          { value: 9, name: "Brera", itemStyle: { color: "#38BDF8" } },
          { value: 8, name: "Ticinese", itemStyle: { color: "#6B7280" } },
        ],
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.5)" } },
        label: { formatter: "{b}: {c} ({d}%)" },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          <Link to="/">
            <Button variant="ghost" className="mb-6 text-ink hover:text-red">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="mb-8">
            <h1 className="text-4xl font-bold text-red mb-2">Accessibility Features</h1>
            <p className="text-xl text-black">42 features mapped</p>
            <p className="text-sm text-muted mt-2">
              Universal design inventory for Milan intervention zones
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Features by Type</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <ReactECharts option={chartOption} style={{ height: "400px" }} />
              <p className="text-xs text-muted mt-4">
                Source: ELABORATOR field audit (May 2025) | Standards: EN 17210, WCAG 2.1 Level AA
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Distribution by Area</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <ReactECharts option={coverageOption} style={{ height: "400px" }} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-sky/20 bg-sky/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Accessibility Highlights</h3>
            <ul className="space-y-2 text-black">
              <li>• 42 universal design features deployed across 4 districts</li>
              <li>• Tactile paving coverage: 12 key pedestrian crossings (100% of priority routes)</li>
              <li>• Audio signal installations at 6 high-traffic intersections</li>
              <li>• Centro Storico leads with 33% of total features (historic center focus)</li>
              <li>• Next phase: additional 18 features planned for Q3 2025</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default Accessibility;
