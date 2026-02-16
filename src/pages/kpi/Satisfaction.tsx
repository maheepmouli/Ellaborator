import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const Satisfaction = () => {
  const chartOption = {
    title: {
      text: "User Satisfaction by Demographic",
      textStyle: { color: "#111111", fontSize: 18, fontWeight: "bold" },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied"], bottom: 0 },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: ["Age 18-35", "Age 36-55", "Age 56+", "Male", "Female", "Disabled"],
      axisLabel: { color: "#111111", rotate: 20 },
    },
    yAxis: {
      type: "value",
      name: "Percentage (%)",
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "Very Satisfied",
        type: "bar",
        stack: "total",
        data: [35, 28, 25, 30, 32, 40],
        itemStyle: { color: "#10B981" },
      },
      {
        name: "Satisfied",
        type: "bar",
        stack: "total",
        data: [42, 48, 45, 45, 44, 38],
        itemStyle: { color: "#38BDF8" },
      },
      {
        name: "Neutral",
        type: "bar",
        stack: "total",
        data: [15, 18, 20, 18, 17, 12],
        itemStyle: { color: "#6B7280" },
      },
      {
        name: "Dissatisfied",
        type: "bar",
        stack: "total",
        data: [8, 6, 10, 7, 7, 10],
        itemStyle: { color: "#E02020" },
      },
    ],
  };

  const trendOption = {
    title: {
      text: "Overall Satisfaction Trend",
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
      name: "Satisfaction (%)",
      min: 60,
      max: 85,
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "Satisfaction",
        type: "line",
        data: [68, 71, 74, 76, 77, 78],
        smooth: true,
        itemStyle: { color: "#10B981" },
        areaStyle: { color: "rgba(16, 185, 129, 0.15)" },
        markLine: {
          data: [{ type: "average", name: "Avg" }],
          label: { formatter: "Target: 75%" },
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
            <h1 className="text-4xl font-bold text-red mb-2">User Satisfaction</h1>
            <p className="text-xl text-black">78% overall satisfaction</p>
            <p className="text-sm text-muted mt-2">
              Perception survey results for Milan mobility interventions (N=1,200)
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Satisfaction by Group</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <ReactECharts option={chartOption} style={{ height: "400px" }} />
              <p className="text-xs text-muted mt-4">
                Source: ELABORATOR intercept survey (June 2025) | Sample: Stratified random (margin of error ±2.8%)
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">6-Month Trend</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <ReactECharts option={trendOption} style={{ height: "350px" }} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-emerald/20 bg-emerald/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Survey Insights</h3>
            <ul className="space-y-2 text-black">
              <li>• Overall satisfaction at 78%, exceeding 75% target threshold</li>
              <li>• Persons with disabilities report highest "Very Satisfied" rate (40%)</li>
              <li>• Satisfaction increased 10pp from Jan (68%) to Jun (78%), indicating positive trend</li>
              <li>• Younger cohort (18-35) shows 77% combined positive satisfaction</li>
              <li>• Top improvement requests: more shaded seating, better wayfinding signage</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default Satisfaction;
