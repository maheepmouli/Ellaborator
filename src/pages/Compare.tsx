import { motion } from "framer-motion";
import { Download, Calendar, MapPin, TrendingDown, TrendingUp, Move } from "lucide-react";
import { useState } from "react";
import ReactECharts from "echarts-for-react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";

const Compare = () => {
  const [selectedCity, setSelectedCity] = useState("milan");
  const [selectedKPI, setSelectedKPI] = useState("mode-share");

  const cities = [
    {
      id: "milan",
      name: "Milan",
      country: "Italy",
      interventions: [
        { year: 2018, name: "Area B (LEZ)", impact: -3, baseline: 48 },
        { year: 2019, name: "Bike Lane Expansion", impact: -2, baseline: 45 },
        { year: 2020, name: "COVID Measures", impact: -8, baseline: 43 },
        { year: 2021, name: "Area B Extension", impact: -4, baseline: 35 },
        { year: 2022, name: "Superblock Pilot", impact: -3, baseline: 31 },
      ],
    },
    {
      id: "barcelona",
      name: "Barcelona",
      country: "Spain",
      interventions: [
        { year: 2017, name: "Superblock Program", impact: -5, baseline: 58 },
        { year: 2019, name: "Green Corridor", impact: -3, baseline: 53 },
        { year: 2020, name: "COVID Measures", impact: -7, baseline: 50 },
        { year: 2021, name: "LEZ Implementation", impact: -4, baseline: 43 },
        { year: 2023, name: "Transit Expansion", impact: -2, baseline: 39 },
      ],
    },
    {
      id: "zaragoza",
      name: "Zaragoza",
      country: "Spain",
      interventions: [
        { year: 2018, name: "Traffic Calming", impact: -2, baseline: 52 },
        { year: 2019, name: "Bike Infrastructure", impact: -3, baseline: 50 },
        { year: 2021, name: "BRT Implementation", impact: -4, baseline: 47 },
        { year: 2022, name: "LEZ Planning", impact: -1, baseline: 43 },
        { year: 2023, name: "Parking Reduction", impact: -2, baseline: 42 },
      ],
    },
  ];

  const kpis = [
    { id: "mode-share", name: "Car Mode Share", unit: "%" },
    { id: "co2", name: "CO₂ Emissions", unit: "%" },
    { id: "safety", name: "Safety Score", unit: "⭐" },
    { id: "accessibility", name: "PT Accessibility", unit: "%" },
  ];

  const selectedCityData = cities.find((c) => c.id === selectedCity);
  
  // Calculate cumulative values for timeline
  const timelineData = selectedCityData?.interventions.reduce((acc, intervention, index) => {
    const prevValue = index === 0 ? intervention.baseline : acc[index - 1].value;
    const newValue = prevValue + intervention.impact;
    return [
      ...acc,
      {
        year: intervention.year,
        name: intervention.name,
        value: newValue,
        impact: intervention.impact,
        baseline: intervention.baseline,
      },
    ];
  }, [] as any[]) || [];

  // Timeline chart
  const timelineOption = {
    title: {
      text: `${selectedCityData?.name} - Intervention Timeline`,
      textStyle: { color: "hsl(259, 60%, 27%)", fontSize: 20, fontWeight: "bold" },
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: any) => {
        const data = params[0];
        const intervention = timelineData[data.dataIndex];
        return `
          <div style="padding: 8px;">
            <strong>${intervention.name}</strong><br/>
            Year: ${intervention.year}<br/>
            Mode Share: ${data.value}%<br/>
            Impact: ${intervention.impact}pp
          </div>
        `;
      },
    },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: {
      type: "category",
      data: timelineData.map((d) => d.year),
      axisLabel: { color: "hsl(259, 40%, 20%)" },
    },
    yAxis: {
      type: "value",
      name: "Car Mode Share (%)",
      axisLabel: { color: "hsl(259, 40%, 20%)" },
    },
    series: [
      {
        type: "line",
        data: timelineData.map((d) => d.value),
        smooth: true,
        itemStyle: { color: "hsl(231, 89%, 68%)" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(101, 125, 245, 0.3)" },
              { offset: 1, color: "rgba(101, 125, 245, 0.05)" },
            ],
          },
        },
        markPoint: {
          data: timelineData.map((d, index) => ({
            coord: [index, d.value],
            value: d.impact,
            itemStyle: {
              color: d.impact < 0 ? "hsl(132, 66%, 81%)" : "hsl(0, 76%, 51%)",
            },
          })),
        },
      },
    ],
  };

  // Impact breakdown chart
  const impactOption = {
    title: {
      text: "Intervention Impact Comparison",
      textStyle: { color: "hsl(259, 60%, 27%)", fontSize: 18, fontWeight: "bold" },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
    xAxis: {
      type: "value",
      name: "Impact (pp)",
      axisLabel: { color: "hsl(259, 40%, 20%)" },
    },
    yAxis: {
      type: "category",
      data: timelineData.map((d) => d.name),
      axisLabel: { color: "hsl(259, 40%, 20%)" },
    },
    series: [
      {
        type: "bar",
        data: timelineData.map((d) => ({
          value: Math.abs(d.impact),
          itemStyle: {
            color: d.impact < -3 ? "hsl(132, 66%, 70%)" : "hsl(231, 89%, 68%)",
          },
        })),
      },
    ],
  };

  // Grid layout configuration
  const [layout, setLayout] = useState<Layout[]>([
    { i: "selector", x: 0, y: 0, w: 12, h: 1, static: true },
    { i: "timeline", x: 0, y: 1, w: 8, h: 3 },
    { i: "metrics", x: 8, y: 1, w: 4, h: 3 },
    { i: "impact", x: 0, y: 4, w: 6, h: 3 },
    { i: "insights", x: 6, y: 4, w: 6, h: 3 },
  ]);

  const totalImpact = timelineData.reduce((sum, d) => sum + d.impact, 0);
  const avgImpact = totalImpact / (timelineData.length || 1);
  const mostEffective = timelineData.sort((a, b) => a.impact - b.impact)[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-light/10 to-green/10">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-purple mb-2">
                Intervention Timeline Comparison
              </h1>
              <p className="text-muted-foreground">
                Track how interventions evolved over time in the same city
              </p>
            </div>
            <Button className="gap-2 bg-violet hover:bg-violet/90 text-primary-foreground">
              <Download className="h-4 w-4" />
              Export View
            </Button>
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-violet/10 to-blue/10 border border-violet/20 rounded-xl p-4 mb-6 flex items-start gap-3 backdrop-blur-sm">
            <Move className="h-5 w-5 text-violet mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Flexible Layout: Drag and resize cards to create your perfect screenshot
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                All key information visible without scrolling - optimized for presentations
              </p>
            </div>
          </div>

          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={100}
            width={1200}
            onLayoutChange={setLayout}
            draggableHandle=".drag-handle"
          >
            {/* City Selector Card */}
            <div key="selector">
              <Card className="p-4 h-full bg-card/80 backdrop-blur-xl border-border-color/50 shadow-lg">
                <div className="flex items-center gap-4">
                  <MapPin className="h-5 w-5 text-violet" />
                  <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="w-[200px] bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border-color">
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}, {city.country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Calendar className="h-5 w-5 text-green ml-4" />
                  <Select value={selectedKPI} onValueChange={setSelectedKPI}>
                    <SelectTrigger className="w-[200px] bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border-color">
                      {kpis.map((kpi) => (
                        <SelectItem key={kpi.id} value={kpi.id}>
                          {kpi.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Badge variant="outline" className="ml-auto border-violet/30 text-violet bg-violet/10">
                    {timelineData.length} interventions tracked
                  </Badge>
                </div>
              </Card>
            </div>

            {/* Timeline Chart Card */}
            <div key="timeline">
              <Card className="p-4 h-full bg-card/80 backdrop-blur-xl border-border-color/50 shadow-lg cursor-move drag-handle">
                <ReactECharts option={timelineOption} style={{ height: "100%" }} />
              </Card>
            </div>

            {/* Key Metrics Card */}
            <div key="metrics">
              <Card className="p-6 h-full bg-card/80 backdrop-blur-xl border-border-color/50 shadow-lg cursor-move drag-handle">
                <h3 className="text-lg font-semibold text-purple mb-4">Key Metrics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-green/20 to-blue/20">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Impact</p>
                      <p className="text-2xl font-bold text-purple font-numbers">
                        {totalImpact.toFixed(1)}pp
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-green" />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-violet/20 to-blue/20">
                    <div>
                      <p className="text-xs text-muted-foreground">Avg per Intervention</p>
                      <p className="text-xl font-bold text-purple font-numbers">
                        {avgImpact.toFixed(1)}pp
                      </p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-violet" />
                  </div>

                  <div className="p-3 rounded-lg bg-gradient-to-r from-green/10 to-green/20 border border-green/30">
                    <p className="text-xs text-muted-foreground mb-1">Most Effective</p>
                    <p className="text-sm font-semibold text-foreground">
                      {mostEffective?.name}
                    </p>
                    <p className="text-xs text-green font-numbers">
                      {mostEffective?.impact}pp reduction
                    </p>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Time Period:</p>
                    <p>
                      {timelineData[0]?.year} - {timelineData[timelineData.length - 1]?.year}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Impact Breakdown Card */}
            <div key="impact">
              <Card className="p-4 h-full bg-card/80 backdrop-blur-xl border-border-color/50 shadow-lg cursor-move drag-handle">
                <ReactECharts option={impactOption} style={{ height: "100%" }} />
              </Card>
            </div>

            {/* Insights Card */}
            <div key="insights">
              <Card className="p-6 h-full bg-card/80 backdrop-blur-xl border-border-color/50 shadow-lg cursor-move drag-handle">
                <h3 className="text-lg font-semibold text-purple mb-4">Key Insights</h3>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-violet/5 to-blue/10 border border-violet/20">
                    <h4 className="text-sm font-semibold text-violet mb-1">
                      Consistent Progress
                    </h4>
                    <p className="text-xs text-foreground">
                      {selectedCityData?.name} achieved steady mode share reduction through
                      sequential interventions
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gradient-to-r from-green/5 to-green/15 border border-green/30">
                    <h4 className="text-sm font-semibold text-green mb-1">
                      Cumulative Effect
                    </h4>
                    <p className="text-xs text-foreground">
                      Combined interventions delivered {Math.abs(totalImpact).toFixed(0)}pp total
                      reduction over {timelineData.length} measures
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue/10 to-lavender/10 border border-blue/30">
                    <h4 className="text-sm font-semibold text-blue mb-1">Implementation Timeline</h4>
                    <p className="text-xs text-foreground">
                      Interventions spaced across{" "}
                      {(timelineData[timelineData.length - 1]?.year || 0) - (timelineData[0]?.year || 0)}{" "}
                      years allowed for gradual adaptation
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-color">
                    <p className="text-xs text-muted-foreground font-medium">
                      📊 Intervention Strategy Analysis
                    </p>
                    <p className="text-xs text-foreground mt-1">
                      Multi-phase approach with infrastructure, regulation, and behavioral measures
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </GridLayout>
        </motion.div>
      </main>
    </div>
  );
};

export default Compare;
