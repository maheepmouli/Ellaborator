import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const CO2Reduction = () => {
  const chartOption = {
    title: {
      text: "Transport CO₂ Emissions Time Series",
      textStyle: { color: "#111111", fontSize: 18, fontWeight: "bold" },
    },
    tooltip: { trigger: "axis" },
    legend: { data: ["Total Emissions", "Target Path"], bottom: 0 },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      axisLabel: { color: "#111111" },
    },
    yAxis: {
      type: "value",
      name: "kt CO₂/month",
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "Total Emissions",
        type: "line",
        data: [85, 83, 80, 78, 77, 76.3],
        itemStyle: { color: "#E02020" },
        smooth: true,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(224, 32, 32, 0.3)" },
            { offset: 1, color: "rgba(224, 32, 32, 0.05)" },
          ]),
        },
      },
      {
        name: "Target Path",
        type: "line",
        data: [85, 82.5, 80, 77.5, 75, 72.5],
        itemStyle: { color: "#10B981" },
        lineStyle: { type: "dashed" },
      },
    ],
  };

  const sourceOption = {
    title: {
      text: "Emissions by Transport Mode",
      textStyle: { color: "#111111", fontSize: 16 },
    },
    tooltip: { trigger: "item" },
    legend: { orient: "vertical", right: "10%", top: "15%" },
    series: [
      {
        name: "Emissions",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: "#fff", borderWidth: 2 },
        label: { show: true, formatter: "{b}: {d}%" },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: "bold" } },
        data: [
          { value: 45.3, name: "Private Cars", itemStyle: { color: "#E02020" } },
          { value: 18.5, name: "Freight", itemStyle: { color: "#6B7280" } },
          { value: 8.2, name: "Public Transit", itemStyle: { color: "#38BDF8" } },
          { value: 4.3, name: "Motorcycles", itemStyle: { color: "#C31414" } },
        ],
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
            <h1 className="text-4xl font-bold text-red mb-2">CO₂ Reduction</h1>
            <p className="text-xl text-black">+10.2% reduction vs baseline</p>
            <p className="text-sm text-muted mt-2">
              Transport emissions monitoring for Milan intervention zone (Jan–Jun 2025)
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Emissions Trend</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <ReactECharts option={chartOption} style={{ height: "400px" }} />
              <p className="text-xs text-muted mt-4">
                Source: ELABORATOR emission model (COPERT 5.5) + traffic counts | Scope: Direct tailpipe emissions only
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Breakdown by Mode (June 2025)</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <ReactECharts option={sourceOption} style={{ height: "400px" }} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-emerald/20 bg-emerald/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Environmental Impact</h3>
            <ul className="space-y-2 text-black">
              <li>• Total emissions reduced from 85 kt/month to 76.3 kt/month (-10.2%)</li>
              <li>• On track to meet 15% reduction target by end of year</li>
              <li>• Private car emissions account for 59% of total, primary focus for interventions</li>
              <li>• Modal shift to cycling/walking contributes 7.1 kt/month reduction</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default CO2Reduction;
