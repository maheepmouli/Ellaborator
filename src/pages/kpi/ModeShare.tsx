import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const ModeShare = () => {
  const chartOption = {
    title: {
      text: "Modal Share Change: Before vs After Intervention",
      textStyle: { color: "#111111", fontSize: 18, fontWeight: "bold" },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {
      data: ["Before", "After"],
      bottom: 0,
    },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: ["Car", "Public Transit", "Cycling", "Walking", "Other"],
      axisLabel: { color: "#111111" },
    },
    yAxis: {
      type: "value",
      name: "Mode Share (%)",
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "Before",
        type: "bar",
        data: [45, 25, 8, 18, 4],
        itemStyle: { color: "#6B7280" },
      },
      {
        name: "After",
        type: "bar",
        data: [33, 30, 15, 20, 2],
        itemStyle: { color: "#E02020" },
      },
    ],
  };

  const trendOption = {
    title: {
      text: "Car Mode Share Trend Over Time",
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
      name: "Share (%)",
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "Car Share",
        type: "line",
        data: [45, 43, 40, 38, 35, 33],
        smooth: true,
        itemStyle: { color: "#E02020" },
        areaStyle: { color: "rgba(224, 32, 32, 0.1)" },
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
          {/* Back Button */}
          <Link to="/">
            <Button variant="ghost" className="mb-6 text-ink hover:text-red">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-red mb-2">Car Mode Share Change</h1>
            <p className="text-xl text-black">-12 percentage points vs baseline</p>
            <p className="text-sm text-muted mt-2">
              Analysis of modal shift interventions in Milan (2025-01 to 2025-06)
            </p>
          </div>

          {/* Charts */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Before/After Comparison</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export PNG
                </Button>
              </div>
              <ReactECharts option={chartOption} style={{ height: "400px" }} />
              <p className="text-xs text-muted mt-4">
                Source: ELABORATOR mobility survey (N=2,500) | Methodology: Revealed preference + GPS tracking
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Monthly Trend</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              <ReactECharts option={trendOption} style={{ height: "350px" }} />
            </div>
          </div>

          {/* Key Insights */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-red/20 bg-red/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Key Insights</h3>
            <ul className="space-y-2 text-black">
              <li>• Car mode share decreased from 45% to 33% (-12pp) following pedestrianization interventions</li>
              <li>• Public transit increased by 5pp, cycling by 7pp, demonstrating effective modal shift</li>
              <li>• Trend shows consistent decline, with steepest reduction in March-April period</li>
              <li>• Results align with TomTom Traffic Index methodology for urban mobility assessment</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default ModeShare;
