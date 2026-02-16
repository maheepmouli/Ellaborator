import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const FSIReduction = () => {
  const chartOption = {
    title: {
      text: "Fatal & Serious Injury Reduction (20-Year Projection)",
      textStyle: { color: "#111111", fontSize: 18, fontWeight: "bold" },
    },
    tooltip: { trigger: "axis" },
    legend: { data: ["Baseline", "With Intervention", "Confidence Band"], bottom: 0 },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: ["2025", "2027", "2029", "2031", "2033", "2035", "2037", "2039", "2041", "2043", "2045"],
      axisLabel: { color: "#111111" },
    },
    yAxis: {
      type: "value",
      name: "Annual FSI Count",
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "Baseline",
        type: "line",
        data: [120, 118, 116, 115, 113, 112, 110, 109, 108, 107, 105],
        itemStyle: { color: "#6B7280" },
        lineStyle: { type: "dashed" },
      },
      {
        name: "With Intervention",
        type: "line",
        data: [120, 112, 105, 98, 92, 87, 83, 80, 77, 75, 73],
        itemStyle: { color: "#E02020" },
        smooth: true,
      },
      {
        name: "Confidence Band",
        type: "line",
        data: [120, 115, 110, 105, 100, 95, 91, 88, 85, 83, 81],
        itemStyle: { color: "rgba(224, 32, 32, 0.3)" },
        lineStyle: { opacity: 0 },
        areaStyle: { color: "rgba(224, 32, 32, 0.1)" },
        stack: "confidence",
        symbol: "none",
      },
    ],
  };

  const reductionOption = {
    title: {
      text: "Monthly FSI Reduction Progress",
      textStyle: { color: "#111111", fontSize: 16 },
    },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      axisLabel: { color: "#111111" },
    },
    yAxis: {
      type: "value",
      name: "Reduction (%)",
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "FSI Reduction",
        type: "bar",
        data: [2.5, 5.1, 8.3, 10.2, 11.8, 12.5],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#E02020" },
            { offset: 1, color: "#C31414" },
          ]),
        },
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
            <h1 className="text-4xl font-bold text-red mb-2">FSI Reduction (20-Year)</h1>
            <p className="text-xl text-black">+12.5% reduction vs baseline</p>
            <p className="text-sm text-muted mt-2">
              Projected impact of safe streets interventions on fatal and serious injuries
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">20-Year Projection</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <ReactECharts option={chartOption} style={{ height: "400px" }} />
              <p className="text-xs text-muted mt-4">
                Source: iRAP Star Rating + ELABORATOR collision data | Model: Exponential decay with 95% CI
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Recent Progress (2025)</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <ReactECharts option={reductionOption} style={{ height: "350px" }} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-red/20 bg-red/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Key Findings</h3>
            <ul className="space-y-2 text-black">
              <li>• Intervention package achieves 12.5% FSI reduction in first 6 months</li>
              <li>• 20-year projection shows 30% cumulative reduction vs baseline trajectory</li>
              <li>• Confidence band (±8%) accounts for traffic volume variation and reporting uncertainty</li>
              <li>• Aligns with Vision Zero targets and iRAP 4-star road safety standards</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default FSIReduction;
