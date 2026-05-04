import { motion } from "framer-motion";
import { Download, Calendar, MapPin, TrendingDown, TrendingUp, Move } from "lucide-react";
import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
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
import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";

const Compare = () => {
  const [selectedCity, setSelectedCity] = useState(CITY_DATA[0]?.city || "Milan");
  const [selectedKPI, setSelectedKPI] = useState(ELABORATOR_KPIS[0]?.id || "kpi1.2");

  const cities = CITY_DATA.map((city) => ({
    id: city.city,
    name: city.city,
    country: "ELABORATOR",
  }));

  const kpis = ELABORATOR_KPIS.map((kpi) => ({
    id: kpi.id,
    name: `${kpi.ref} ${kpi.shortName}`,
    unit: kpi.unit,
  }));

  const selectedCityData = CITY_DATA.find((c) => c.city === selectedCity);
  const selectedKpiMeta = ELABORATOR_KPIS.find((k) => k.id === selectedKPI);

  const timelineData =
    selectedCityData && selectedCityData.kpiData[selectedKPI]
      ? [
          {
            year: 2024,
            name: "Baseline",
            value:
              Number(selectedCityData.kpiData[selectedKPI].mainValue) -
              Number(selectedCityData.kpiData[selectedKPI].change || 0),
            impact: 0,
            baseline:
              Number(selectedCityData.kpiData[selectedKPI].mainValue) -
              Number(selectedCityData.kpiData[selectedKPI].change || 0),
          },
          {
            year: 2025,
            name: "Intervention",
            value: Number(selectedCityData.kpiData[selectedKPI].mainValue),
            impact: Number(selectedCityData.kpiData[selectedKPI].change || 0),
            baseline:
              Number(selectedCityData.kpiData[selectedKPI].mainValue) -
              Number(selectedCityData.kpiData[selectedKPI].change || 0),
          },
        ]
      : [];

  const cityComparisonRows = CITY_DATA.map((city) => {
    const kpi = city.kpiData[selectedKPI];
    const intervention = Number(kpi?.mainValue || 0);
    const change = Number(kpi?.change || 0);
    const baseline = intervention - change;
    return {
      city: city.city,
      baseline,
      intervention,
      change,
    };
  });

  // Grid layout configuration
  const [layout, setLayout] = useState<Layout[]>([
    { i: "selector", x: 0, y: 0, w: 12, h: 1, static: true },
    { i: "timeline", x: 0, y: 1, w: 8, h: 3 },
    { i: "metrics", x: 8, y: 1, w: 4, h: 3 },
    { i: "impact", x: 0, y: 4, w: 6, h: 3 },
    { i: "insights", x: 6, y: 4, w: 6, h: 3 },
  ]);

  const totalImpact = cityComparisonRows.reduce((sum, d) => sum + d.change, 0);
  const avgImpact = totalImpact / (cityComparisonRows.length || 1);
  const mostEffective = [...cityComparisonRows].sort((a, b) => b.change - a.change)[0];

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
                    {cityComparisonRows.length} cities compared
                  </Badge>
                </div>
              </Card>
            </div>

            {/* Timeline Chart Card */}
            <div key="timeline">
              <Card className="p-4 h-full bg-card/80 backdrop-blur-xl border-border-color/50 shadow-lg cursor-move drag-handle">
                <h3 className="text-lg font-semibold text-purple mb-3 px-1">
                  {selectedCityData?.city || selectedCity} — KPI Timeline
                </h3>
                <div className="h-[calc(100%-2.75rem)] min-h-[200px] w-full">
                  {timelineData.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">No timeline data for this KPI.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={timelineData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
                        <defs>
                          <linearGradient id="compare-line-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(101, 125, 245, 0.35)" />
                            <stop offset="100%" stopColor="rgba(101, 125, 245, 0.05)" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                        <XAxis
                          dataKey="year"
                          tick={{ fill: "hsl(259, 40%, 20%)" }}
                          tickFormatter={(y) => String(y)}
                        />
                        <YAxis
                          tick={{ fill: "hsl(259, 40%, 20%)" }}
                          name={selectedKpiMeta?.unit || ""}
                          width={56}
                        />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                          formatter={(value: number, _n, item: { payload?: { impact?: number } }) => {
                            const row = item?.payload;
                            const sfx = selectedKpiMeta?.unit === "%" ? "pp" : "";
                            const ch =
                              row && typeof row.impact === "number"
                                ? `Δ ${row.impact > 0 ? "+" : ""}${row.impact}${sfx}`
                                : "";
                            return [`${value}${selectedKpiMeta?.unit || ""}`, ch || ""];
                          }}
                          labelFormatter={(_l, payload) => {
                            const row = payload?.[0]?.payload as { name?: string; year?: number } | undefined;
                            return row?.name != null && row.year != null ? `${row.name} (${row.year})` : "";
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          name="KPI value"
                          stroke="none"
                          fill="url(#compare-line-area)"
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(231, 89%, 68%)"
                          strokeWidth={2}
                          dot={(props: { cx?: number; cy?: number; index?: number }) => {
                            const { cx, cy, index } = props;
                            const row = typeof index === "number" ? timelineData[index] : undefined;
                            if (cx == null || cy == null || !row) return null;
                            const fill =
                              row.impact < 0 ? "hsl(132, 66%, 81%)" : "hsl(0, 76%, 51%)";
                            return <circle cx={cx} cy={cy} r={7} fill={fill} stroke="#fff" strokeWidth={2} />;
                          }}
                          activeDot={{ r: 9 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
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
                      {mostEffective?.city}
                    </p>
                    <p className="text-xs text-green font-numbers">
                      {mostEffective?.change > 0 ? "+" : ""}
                      {mostEffective?.change}
                      {selectedKpiMeta?.unit === "%" ? "pp" : ""}
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
                <h3 className="text-lg font-semibold text-purple mb-3 px-1">Cross-City KPI Comparison</h3>
                <div className="h-[calc(100%-2.75rem)] min-h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={cityComparisonRows}
                      margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "hsl(259, 40%, 20%)" }} />
                      <YAxis type="category" dataKey="city" width={100} tick={{ fill: "hsl(259, 40%, 20%)", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        formatter={(v: number, _name, props) => [
                          `${v}${selectedKpiMeta?.unit || ""}`,
                          props?.payload?.change != null
                            ? `Δ ${props.payload.change > 0 ? "+" : ""}${props.payload.change}`
                            : "",
                        ]}
                      />
                      <Bar dataKey="intervention" name="Intervention value" radius={[0, 4, 4, 0]}>
                        {cityComparisonRows.map((d, i) => (
                          <Cell
                            key={d.city}
                            fill={
                              d.change > 0 ? "hsl(132, 66%, 70%)" : "hsl(231, 89%, 68%)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
                      {selectedCityData?.city} shows a measurable KPI shift from baseline to intervention.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gradient-to-r from-green/5 to-green/15 border border-green/30">
                    <h4 className="text-sm font-semibold text-green mb-1">
                      Cumulative Effect
                    </h4>
                    <p className="text-xs text-foreground">
                      Combined city results show {totalImpact > 0 ? "+" : ""}
                      {totalImpact.toFixed(1)}
                      {selectedKpiMeta?.unit === "%" ? "pp" : ` ${selectedKpiMeta?.unit || ""}`} total change.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue/10 to-lavender/10 border border-blue/30">
                    <h4 className="text-sm font-semibold text-blue mb-1">Implementation Timeline</h4>
                    <p className="text-xs text-foreground">
                      Baseline and intervention are spaced across{" "}
                      {(timelineData[timelineData.length - 1]?.year || 0) - (timelineData[0]?.year || 0)}{" "}
                      year(s) in this comparison view.
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
