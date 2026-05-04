import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, MapPin, Users, Calendar } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KPICard from "@/components/KPICard";

const modalEvolution = [
  { month: "Jan", car: 45, transit: 25, cycle: 8, walk: 18 },
  { month: "Feb", car: 43, transit: 26, cycle: 9, walk: 18 },
  { month: "Mar", car: 40, transit: 27, cycle: 11, walk: 19 },
  { month: "Apr", car: 38, transit: 28, cycle: 12, walk: 19 },
  { month: "May", car: 35, transit: 29, cycle: 14, walk: 20 },
  { month: "Jun", car: 33, transit: 30, cycle: 15, walk: 20 },
];

const collisionPie = [
  { name: "Fatal", value: 12, color: "#E02020" },
  { name: "Serious", value: 48, color: "#C31414" },
  { name: "Slight", value: 120, color: "#6B7280" },
  { name: "Damage Only", value: 85, color: "#38BDF8" },
];

const emissionsBars = [
  { month: "Jan", kt: 85 },
  { month: "Feb", kt: 83 },
  { month: "Mar", kt: 80 },
  { month: "Apr", kt: 78 },
  { month: "May", kt: 77 },
  { month: "Jun", kt: 76.3 },
];

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

  const stakeholderReportHref = useMemo(() => {
    const name = city?.name;
    if (!name) return "/report";
    const q = new URLSearchParams({
      city: name,
      kpi: "kpi1.2",
      scenario: "intervention",
    });
    return `/report?${q.toString()}`;
  }, [city?.name]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
          <Link to="/cities">
            <Button variant="ghost" className="mb-6 text-ink hover:text-red">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Cities
            </Button>
          </Link>

          <div className="mb-8 rounded-2xl border border-border-color bg-card p-8 shadow-md">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-red mb-2">{city.name}</h1>
                <p className="text-xl text-black">{city.country}</p>
              </div>
              <Button variant="outline" className="gap-2 px-4" asChild>
                <Link to={stakeholderReportHref} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Report
                </Link>
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

          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <KPICard title="Car Mode Share" value="-12" unit="pp" change="-12% vs baseline" to="/kpi/mode-share" />
            <KPICard title="FSI Reduction" value="12.5" unit="%" change="+12.5% vs baseline" to="/kpi/fsi-reduction" />
            <KPICard title="CO₂ Reduction" value="10.2" unit="%" change="+10.2% vs baseline" to="/kpi/co2-reduction" />
          </div>

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
                <h3 className="text-base font-semibold text-ink mb-4">Modal Share Evolution</h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={modalEvolution} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fill: "#111" }} />
                      <YAxis tick={{ fill: "#111" }} domain={[0, 50]} name="Share (%)" />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                      <Legend />
                      <Line type="monotone" dataKey="car" name="Car" stroke="#E02020" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="transit" name="Public Transit" stroke="#38BDF8" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="cycle" name="Cycling" stroke="#10B981" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="walk" name="Walking" stroke="#6B7280" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted mt-4">
                  Source: ELABORATOR mobility survey | Methodology: GPS tracking + revealed preference
                </p>
              </div>
            </TabsContent>

            <TabsContent value="safety">
              <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
                <h3 className="text-base font-semibold text-ink mb-4">Collision Severity Distribution</h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={collisionPie}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={90}
                        outerRadius={140}
                        paddingAngle={2}
                        label={({ name, value, percent }) =>
                          `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {collisionPie.map((e) => (
                          <Cell key={e.name} fill={e.color} stroke="#fff" strokeWidth={1} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted mt-4">Source: National collision database | Period: 2025-01 to 2025-06</p>
              </div>
            </TabsContent>

            <TabsContent value="environment">
              <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
                <h3 className="text-base font-semibold text-ink mb-4">Transport Emissions Reduction</h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emissionsBars} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fill: "#111" }} />
                      <YAxis tick={{ fill: "#111" }} name="kt CO₂/month" domain={[74, 88]} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                      <Bar dataKey="kt" name="Emissions" fill="#E02020" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted mt-4">Source: COPERT 5.5 emission model + traffic counts</p>
              </div>
            </TabsContent>

            <TabsContent value="accessibility">
              <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
                <div className="text-center py-12">
                  <h3 className="text-xl font-bold text-red mb-2">42 Accessibility Features</h3>
                  <p className="text-muted">Detailed accessibility audit results for {city.name}</p>
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
