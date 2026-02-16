import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const SafetyStars = () => {
  const radarOption = {
    title: {
      text: "Safety Star Ratings by Mode",
      textStyle: { color: "#111111", fontSize: 18, fontWeight: "bold" },
    },
    tooltip: {},
    legend: { data: ["Current", "Target (4-Star)"], bottom: 0 },
    radar: {
      indicator: [
        { name: "Pedestrian", max: 5 },
        { name: "Cyclist", max: 5 },
        { name: "Motorcyclist", max: 5 },
        { name: "Vehicle Occupant", max: 5 },
      ],
      splitNumber: 5,
      axisLabel: { show: true, color: "#111111" },
    },
    series: [
      {
        name: "Safety Rating",
        type: "radar",
        data: [
          {
            value: [3.5, 3.2, 2.8, 4.1],
            name: "Current",
            itemStyle: { color: "#E02020" },
            areaStyle: { color: "rgba(224, 32, 32, 0.2)" },
          },
          {
            value: [4.0, 4.0, 4.0, 4.0],
            name: "Target (4-Star)",
            itemStyle: { color: "#10B981" },
            lineStyle: { type: "dashed" },
          },
        ],
      },
    ],
  };

  const speedOption = {
    title: {
      text: "85th Percentile Speed by Street Type",
      textStyle: { color: "#111111", fontSize: 16 },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: ["Residential", "Collector", "Arterial", "School Zone"],
      axisLabel: { color: "#111111" },
    },
    yAxis: {
      type: "value",
      name: "Speed (km/h)",
      axisLabel: { color: "#111111" },
    },
    series: [
      {
        name: "85th %ile Speed",
        type: "bar",
        data: [28, 42, 58, 24],
        itemStyle: {
          color: (params: any) => {
            const speeds = [28, 42, 58, 24];
            const limits = [30, 50, 60, 30];
            return speeds[params.dataIndex] <= limits[params.dataIndex] ? "#10B981" : "#E02020";
          },
        },
        label: { show: true, position: "top", formatter: "{c} km/h" },
        markLine: {
          data: [
            { yAxis: 30, name: "Res Limit", lineStyle: { color: "#6B7280", type: "dashed" } },
            { yAxis: 50, name: "Col Limit", lineStyle: { color: "#6B7280", type: "dashed" } },
          ],
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
            <h1 className="text-4xl font-bold text-red mb-2">Pedestrian Safety Stars</h1>
            <p className="text-xl text-black">3.5 ⭐ safety rating</p>
            <p className="text-sm text-muted mt-2">
              iRAP-based road safety assessment for Milan intervention corridors
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Star Ratings by User Type</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <ReactECharts option={radarOption} style={{ height: "450px" }} />
              <p className="text-xs text-muted mt-4">
                Source: iRAP ViDA v4.2 | Assessment: 12 km of intervention routes | Date: May 2025
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Speed Compliance</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <ReactECharts option={speedOption} style={{ height: "350px" }} />
              <p className="text-xs text-muted mt-4">
                Green bars indicate compliance with posted limits. Red indicates exceeding limit.
              </p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-red/20 bg-red/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Safety Assessment Summary</h3>
            <ul className="space-y-2 text-black">
              <li>• Average pedestrian safety rating: 3.5 stars (0.5 stars below 4-star target)</li>
              <li>• Vehicle occupants achieve 4.1 stars (infrastructure design priority effective)</li>
              <li>• Motorcyclist rating at 2.8 stars identified as improvement area</li>
              <li>• 85th percentile speeds within limits on 75% of assessed segments</li>
              <li>• Arterial roads require traffic calming to meet 4-star cyclist standard</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default SafetyStars;
