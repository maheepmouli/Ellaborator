import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";

const ModalShareTrend = () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const carData = [45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 33];
  const publicTransitData = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42];
  const cyclingData = [15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20];
  const walkingData = [10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5];

  const option = {
    grid: { left: 60, right: 40, top: 40, bottom: 80 },
    xAxis: {
      type: "category",
      data: months,
      axisLine: { lineStyle: { color: "#E5E7EB" } },
      axisLabel: { color: "#111111", fontFamily: "Inter" },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#E5E7EB" } },
      axisLabel: { 
        color: "#6B7280", 
        fontFamily: "Inter",
        formatter: "{value}%"
      },
    },
    series: [
      {
        name: "Car",
        type: "line" as const,
        data: carData,
        smooth: true,
        lineStyle: { color: "#E02020", width: 3 },
        itemStyle: { color: "#E02020" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(224, 32, 32, 0.3)" },
              { offset: 1, color: "rgba(224, 32, 32, 0.05)" },
            ],
          },
        },
      },
      {
        name: "Public Transit",
        type: "line" as const,
        data: publicTransitData,
        smooth: true,
        lineStyle: { color: "#10B981", width: 3 },
        itemStyle: { color: "#10B981" },
      },
      {
        name: "Cycling",
        type: "line" as const,
        data: cyclingData,
        smooth: true,
        lineStyle: { color: "#38BDF8", width: 3 },
        itemStyle: { color: "#38BDF8" },
      },
      {
        name: "Walking",
        type: "line" as const,
        data: walkingData,
        smooth: true,
        lineStyle: { color: "#6B7280", width: 2 },
        itemStyle: { color: "#6B7280" },
      },
    ],
    legend: {
      bottom: 10,
      data: ["Car", "Public Transit", "Cycling", "Walking"],
      textStyle: { color: "#111111", fontFamily: "Inter" },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderColor: "#E5E7EB",
      textStyle: { color: "#111111" },
      formatter: (params: any) => {
        let result = `<div style="font-weight: 600; margin-bottom: 4px;">${params[0].axisValue}</div>`;
        params.forEach((param: any) => {
          const color = typeof param.color === "string" ? param.color : (param.color?.colorStops?.[0]?.color ?? "#000");
          result += `<div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; background: ${color}; border-radius: 50%;"></span>
            <span>${param.seriesName}: <strong>${param.value}%</strong></span>
          </div>`;
        });
        return result;
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      className="rounded-2xl border-2 border-border-color bg-card p-8 shadow-lg"
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-red mb-2">Modal Share Evolution 2024</h3>
        <p className="text-black">Monthly trends showing shift from car to sustainable modes</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-xs text-muted">Car Share</p>
          <p className="font-numbers text-3xl font-bold text-red">33%</p>
          <p className="text-xs text-emerald">↓ 12pp</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Public Transit</p>
          <p className="font-numbers text-3xl font-bold text-emerald">42%</p>
          <p className="text-xs text-emerald">↑ 12pp</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Cycling</p>
          <p className="font-numbers text-3xl font-bold text-sky">20%</p>
          <p className="text-xs text-emerald">↑ 5pp</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Walking</p>
          <p className="font-numbers text-3xl font-bold text-muted">5%</p>
          <p className="text-xs text-red">↓ 5pp</p>
        </div>
      </div>

      {/* Chart */}
      <ReactECharts option={option} style={{ height: "320px" }} />
    </motion.div>
  );
};

export default ModalShareTrend;