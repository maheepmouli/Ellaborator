import { motion } from "framer-motion";
import { ArrowLeft, Download, MapPin, Users, Calendar } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KPICard from "@/components/KPICard";

const CityDetail = () => {
  const { cityId } = useParams();

  const cityData: Record<string, any> = {
    milan: {
      name: "Milan",
      country: "Italy",
      population: "1.4M",
      interventions: 8,
      lat: 45.4642,
      lon: 9.19,
    },
    zaragoza: {
      name: "Zaragoza",
      country: "Spain",
      population: "681K",
      interventions: 5,
      lat: 41.6488,
      lon: -0.8891,
    },
    barcelona: {
      name: "Barcelona",
      country: "Spain",
      population: "1.6M",
      interventions: 12,
      lat: 41.3874,
      lon: 2.1686,
    },
  };

  const city = cityData[cityId || "milan"];

  const modalShareOption = {
    title: {
      text: "Modal Share Evolution",
      textStyle: { color: "#111111", fontSize: 16, fontWeight: "bold" },
    },
    tooltip: { trigger: "axis" },
    legend: { data: ["Car", "Public Transit", "Cycling", "Walking"], bottom: 0 },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "15%", containLabel: true },
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
        name: "Car",
        type: "line",
        data: [45, 43, 40, 38, 35, 33],
        smooth: true,
        itemStyle: { color: "#E02020" },
      },
      {
        name: "Public Transit",
        type: "line",
        data: [25, 26, 27, 28, 29, 30],
        smooth: true,
        itemStyle: { color: "#38BDF8" },
      },
      {
        name: "Cycling",
        type: "line",
        data: [8, 9, 11, 12, 14, 15],
        smooth: true,
        itemStyle: { color: "#10B981" },
      },
      {
        name: "Walking",
        type: "line",
        data: [18, 18, 19, 19, 20, 20],
        smooth: true,
        itemStyle: { color: "#6B7280" },
      },
    ],
  };

  const safetyOption = {
    title: {
      text: "Collision Severity Distribution",
      textStyle: { color: "#111111", fontSize: 16, fontWeight: "bold" },
    },
    tooltip: { trigger: "item" },
    series: [
      {
        name: "Collisions",
        type: "pie",
        radius: ["40%", "70%"],
        data: [
          { value: 12, name: "Fatal", itemStyle: { color: "#E02020" } },
          { value: 48, name: "Serious", itemStyle: { color: "#C31414" } },
          { value: 120, name: "Slight", itemStyle: { color: "#6B7280" } },
          { value: 85, name: "Damage Only", itemStyle: { color: "#38BDF8" } },
        ],
        label: { formatter: "{b}: {c} ({d}%)" },
      },
    ],
  };

  const emissionsOption = {
    title: {
      text: "Transport Emissions Reduction",
      textStyle: { color: "#111111", fontSize: 16, fontWeight: "bold" },
    },
    tooltip: { trigger: "axis" },
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
        name: "Emissions",
        type: "bar",
        data: [85, 83, 80, 78, 77, 76.3],
        itemStyle: { color: "#E02020" },
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
          className="max-w-7xl mx-auto"
        >
          {/* Back Button */}
          <Link to="/cities">
            <Button variant="ghost" className="mb-6 text-ink hover:text-red">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Cities
            </Button>
          </Link>

          {/* City Header */}
          <div className="mb-8 rounded-2xl border border-border-color bg-card p-8 shadow-md">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-red mb-2">{city.name}</h1>
                <p className="text-xl text-black">{city.country}</p>
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-red" />
                <div>
                  <div className="text-sm text-muted">Population</div>
                  <div className="text-lg font-bold text-ink">{city.population}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-red" />
                <div>
                  <div className="text-sm text-muted">Interventions</div>
                  <div className="text-lg font-bold text-ink">{city.interventions}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-red" />
                <div>
                  <div className="text-sm text-muted">Analysis Period</div>
                  <div className="text-lg font-bold text-ink">Jan–Jun 2025</div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Overview */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <KPICard
              title="Car Mode Share"
              value="-12"
              unit="pp"
              change="-12% vs baseline"
              to="/kpi/mode-share"
            />
            <KPICard
              title="FSI Reduction"
              value="12.5"
              unit="%"
              change="+12.5% vs baseline"
              to="/kpi/fsi-reduction"
            />
            <KPICard
              title="CO₂ Reduction"
              value="10.2"
              unit="%"
              change="+10.2% vs baseline"
              to="/kpi/co2-reduction"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="mobility" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-8">
              <TabsTrigger value="mobility">Mobility</TabsTrigger>
              <TabsTrigger value="safety">Safety</TabsTrigger>
              <TabsTrigger value="environment">Environment</TabsTrigger>
              <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
              <TabsTrigger value="satisfaction">Satisfaction</TabsTrigger>
            </TabsList>

            <TabsContent value="mobility">
              <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
                <ReactECharts option={modalShareOption} style={{ height: "400px" }} />
                <p className="text-xs text-muted mt-4">
                  Source: ELABORATOR mobility survey | Methodology: GPS tracking + revealed preference
                </p>
              </div>
            </TabsContent>

            <TabsContent value="safety">
              <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
                <ReactECharts option={safetyOption} style={{ height: "400px" }} />
                <p className="text-xs text-muted mt-4">
                  Source: National collision database | Period: 2025-01 to 2025-06
                </p>
              </div>
            </TabsContent>

            <TabsContent value="environment">
              <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
                <ReactECharts option={emissionsOption} style={{ height: "400px" }} />
                <p className="text-xs text-muted mt-4">
                  Source: COPERT 5.5 emission model + traffic counts
                </p>
              </div>
            </TabsContent>

            <TabsContent value="accessibility">
              <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
                <div className="text-center py-12">
                  <h3 className="text-xl font-bold text-red mb-2">42 Accessibility Features</h3>
                  <p className="text-muted">
                    Detailed accessibility audit results for {city.name}
                  </p>
                  <Link to="/kpi/accessibility">
                    <Button variant="outline" className="mt-4">
                      View Full Report
                    </Button>
                  </Link>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="satisfaction">
              <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
                <div className="text-center py-12">
                  <h3 className="text-xl font-bold text-red mb-2">78% Satisfaction</h3>
                  <p className="text-muted">Overall user satisfaction with interventions</p>
                  <Link to="/kpi/satisfaction">
                    <Button variant="outline" className="mt-4">
                      View Survey Results
                    </Button>
                  </Link>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
};

export default CityDetail;
