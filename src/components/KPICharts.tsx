import ReactECharts from "echarts-for-react";
import { KPIValue } from "@/data/kpiDefinitions";

interface KPIChartProps {
  kpiId: string;
  data: KPIValue;
  cityName: string;
}

// Stacked bar chart for Mode Share (KPI 1.2)
export const ModeShareChart = ({ data, cityName }: { data: KPIValue; cityName: string }) => {
  const breakdown = data.breakdown || {};
  const categories = Object.keys(breakdown);
  const values = Object.values(breakdown);

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: { left: "3%", right: "4%", bottom: "3%", top: "10%", containLabel: true },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { formatter: "{value}%", color: "#8578C3", fontSize: 10 },
      splitLine: { lineStyle: { color: "#2F1B6D20" } },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#8578C3", fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Mode Share",
        type: "bar",
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: ["#B0EDBA", "#96C2EF", "#657DF5", "#8578C3", "#2F1B6D"][i % 5],
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: "60%",
        label: {
          show: true,
          position: "right",
          formatter: "{c}%",
          fontSize: 10,
          color: "#2F1B6D",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "200px", width: "100%" }} />;
};

// Radar chart for Safety Stars (KPI 2.1)
export const SafetyRadarChart = ({ data }: { data: KPIValue }) => {
  const breakdown = data.breakdown || {};
  const indicators = Object.keys(breakdown).map((key) => ({
    name: key,
    max: 5,
  }));
  const values = Object.values(breakdown);

  const option = {
    tooltip: {},
    radar: {
      indicator: indicators,
      shape: "polygon",
      splitNumber: 5,
      axisName: { color: "#8578C3", fontSize: 10 },
      splitLine: { lineStyle: { color: "#657DF520" } },
      splitArea: { areaStyle: { color: ["#D3E3FF20", "#96C2EF10"] } },
      axisLine: { lineStyle: { color: "#657DF530" } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: values,
            name: "Safety Rating",
            areaStyle: { color: "#657DF530" },
            lineStyle: { color: "#657DF5", width: 2 },
            itemStyle: { color: "#657DF5" },
          },
        ],
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "200px", width: "100%" }} />;
};

// Bar chart for Infrastructure (KPI 3.1)
export const InfrastructureBarChart = ({ data }: { data: KPIValue }) => {
  const breakdown = data.breakdown || {};
  const categories = Object.keys(breakdown);
  const values = Object.values(breakdown);

  const option = {
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "10%", containLabel: true },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#8578C3", fontSize: 9, rotate: 30 },
      axisLine: { lineStyle: { color: "#657DF530" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#8578C3", fontSize: 10 },
      splitLine: { lineStyle: { color: "#2F1B6D10" } },
    },
    series: [
      {
        type: "bar",
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "#B0EDBA" },
                { offset: 1, color: "#657DF5" },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barWidth: "50%",
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "200px", width: "100%" }} />;
};

// Line chart for Emissions (KPI 3.2)
export const EmissionsLineChart = ({ data }: { data: KPIValue }) => {
  const timeSeries = data.timeSeries || [];
  const years = timeSeries.map((t) => t.year.toString());
  const values = timeSeries.map((t) => t.value);

  const option = {
    tooltip: {
      trigger: "axis",
      formatter: (params: any) => `${params[0].name}: ${params[0].value}% of baseline`,
    },
    grid: { left: "3%", right: "4%", bottom: "3%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: years,
      axisLabel: { color: "#8578C3", fontSize: 10 },
      axisLine: { lineStyle: { color: "#657DF530" } },
    },
    yAxis: {
      type: "value",
      min: 60,
      max: 105,
      axisLabel: { formatter: "{value}%", color: "#8578C3", fontSize: 10 },
      splitLine: { lineStyle: { color: "#2F1B6D10" } },
    },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        symbol: "circle",
        symbolSize: 8,
        lineStyle: { color: "#2F1B6D", width: 3 },
        itemStyle: { color: "#2F1B6D", borderColor: "#fff", borderWidth: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "#657DF540" },
              { offset: 1, color: "#657DF505" },
            ],
          },
        },
        markLine: {
          data: [{ yAxis: 100, name: "Baseline" }],
          lineStyle: { color: "#8578C3", type: "dashed" },
          label: { formatter: "Baseline", fontSize: 9 },
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "200px", width: "100%" }} />;
};

// Gauge chart for Satisfaction (KPI 4.1)
export const SatisfactionGaugeChart = ({ data }: { data: KPIValue }) => {
  const option = {
    series: [
      {
        type: "gauge",
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 10,
        radius: "100%",
        center: ["50%", "70%"],
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.3, "#8578C3"],
              [0.6, "#657DF5"],
              [0.8, "#96C2EF"],
              [1, "#B0EDBA"],
            ],
          },
        },
        pointer: {
          itemStyle: { color: "#2F1B6D" },
          length: "60%",
          width: 6,
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          formatter: "{value}%",
          fontSize: 24,
          fontWeight: "bold",
          color: "#2F1B6D",
          offsetCenter: [0, "20%"],
        },
        data: [{ value: data.mainValue }],
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "180px", width: "100%" }} />;
};

// Horizontal bar for Accessibility (KPI 4.2)
export const AccessibilityBarChart = ({ data }: { data: KPIValue }) => {
  const breakdown = data.breakdown || {};
  const categories = Object.keys(breakdown);
  const values = Object.values(breakdown);

  const option = {
    tooltip: { trigger: "axis" },
    grid: { left: "30%", right: "10%", bottom: "3%", top: "3%", containLabel: false },
    xAxis: {
      type: "value",
      axisLabel: { color: "#8578C3", fontSize: 10 },
      splitLine: { lineStyle: { color: "#2F1B6D10" } },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#8578C3", fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: ["#657DF5", "#8578C3", "#96C2EF", "#B0EDBA"][i % 4],
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: "50%",
        label: {
          show: true,
          position: "right",
          fontSize: 10,
          color: "#2F1B6D",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: "180px", width: "100%" }} />;
};

// Main component that renders the appropriate chart
const KPIChart = ({ kpiId, data, cityName }: KPIChartProps) => {
  switch (kpiId) {
    case "kpi1.2":
      return <ModeShareChart data={data} cityName={cityName} />;
    case "kpi2.1":
      return <SafetyRadarChart data={data} />;
    case "kpi3.1":
      return <InfrastructureBarChart data={data} />;
    case "kpi3.2":
      return <EmissionsLineChart data={data} />;
    case "kpi4.1":
      return <SatisfactionGaugeChart data={data} />;
    case "kpi4.2":
      return <AccessibilityBarChart data={data} />;
    default:
      return <ModeShareChart data={data} cityName={cityName} />;
  }
};

export default KPIChart;
