import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";

const CongestionLevelPlot = () => {
  const monthlyData = [
    { month: "Jan", y2024: 23, y2023: 20 },
    { month: "Feb", y2024: 25, y2023: 23 },
    { month: "Mar", y2024: 23, y2023: 24 },
    { month: "Apr", y2024: 28, y2023: 23 },
    { month: "May", y2024: 29, y2023: 27 },
    { month: "Jun", y2024: 28, y2023: 26 },
    { month: "Jul", y2024: 30, y2023: 24 },
    { month: "Aug", y2024: 16, y2023: 13 },
    { month: "Sep", y2024: 28, y2023: 26 },
    { month: "Oct", y2024: 30, y2023: 28 },
    { month: "Nov", y2024: 28, y2023: 28 },
    { month: "Dec", y2024: 30, y2023: 27 },
  ];

  const option = {
    grid: { left: 60, right: 40, top: 40, bottom: 60 },
    xAxis: {
      type: "category",
      data: monthlyData.map((d) => d.month),
      axisLine: { lineStyle: { color: "#E5E7EB" } },
      axisLabel: { color: "#111111", fontFamily: "Inter" },
    },
    yAxis: {
      type: "value",
      max: 35,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#E5E7EB" } },
      axisLabel: { color: "#6B7280", fontFamily: "Inter" },
    },
    series: [
      {
        name: "2024",
        type: "bar",
        data: monthlyData.map((d) => d.y2024),
        itemStyle: { color: "#E02020", borderRadius: [4, 4, 0, 0] },
        barWidth: 12,
      },
      {
        name: "2023",
        type: "bar",
        data: monthlyData.map((d) => d.y2023),
        itemStyle: { color: "#D1D5DB", borderRadius: [4, 4, 0, 0] },
        barWidth: 12,
      },
    ],
    legend: {
      bottom: 10,
      data: ["2024", "2023"],
      textStyle: { color: "#111111", fontFamily: "Inter" },
      itemWidth: 20,
      itemHeight: 8,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderColor: "#E5E7EB",
      textStyle: { color: "#111111" },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="rounded-2xl border-2 border-border-color bg-card p-8 shadow-lg"
    >
      {/* Header Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* World Rank Card */}
        <div className="space-y-3">
          <p className="text-sm text-muted font-medium">World rank 2024</p>
          <h3 className="text-2xl font-bold text-ink">Congestion level</h3>
          <div className="flex items-center justify-center w-24 h-24 rounded-full bg-red">
            <span className="font-numbers text-4xl font-bold text-white">300</span>
          </div>
        </div>

        {/* Average Level Card */}
        <div className="space-y-3">
          <p className="text-sm text-muted font-medium">Average congestion level</p>
          <div className="flex items-baseline gap-2">
            <span className="font-numbers text-6xl font-bold text-ink">26</span>
            <span className="font-numbers text-3xl text-muted">%</span>
          </div>
          <p className="text-sm">
            <span className="text-red font-semibold">2%</span>
            <span className="text-muted">p more than in 2023</span>
          </p>
        </div>

        {/* Placeholder for future metric */}
        <div className="space-y-3">
          <p className="text-sm text-muted font-medium">Peak hours impact</p>
          <div className="flex items-baseline gap-2">
            <span className="font-numbers text-6xl font-bold text-ink">42</span>
            <span className="font-numbers text-3xl text-muted">%</span>
          </div>
          <p className="text-sm text-muted">Morning & evening peaks</p>
        </div>
      </div>

      {/* Chart Section */}
      <div>
        <h4 className="text-lg font-bold text-ink mb-4">Monthly congestion level</h4>
        <ReactECharts option={option} style={{ height: "300px" }} />
      </div>
    </motion.div>
  );
};

export default CongestionLevelPlot;