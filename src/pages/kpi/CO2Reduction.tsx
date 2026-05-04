import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const emissionsTrend = [
  { month: "Jan", total: 85, target: 85 },
  { month: "Feb", total: 83, target: 82.5 },
  { month: "Mar", total: 80, target: 80 },
  { month: "Apr", total: 78, target: 77.5 },
  { month: "May", total: 77, target: 75 },
  { month: "Jun", total: 76.3, target: 72.5 },
];

const emissionsByMode = [
  { name: "Private Cars", value: 45.3, color: "#E02020" },
  { name: "Freight", value: 18.5, color: "#6B7280" },
  { name: "Public Transit", value: 8.2, color: "#38BDF8" },
  { name: "Motorcycles", value: 4.3, color: "#C31414" },
];

const CO2Reduction = () => {
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
                <h2 className="text-xl font-bold text-red">Transport CO₂ Emissions Time Series</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={emissionsTrend} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    <defs>
                      <linearGradient id="co2-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(224, 32, 32, 0.35)" />
                        <stop offset="100%" stopColor="rgba(224, 32, 32, 0.05)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fill: "#111" }} />
                    <YAxis tick={{ fill: "#111" }} name="kt CO₂/month" />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <Legend wrapperStyle={{ paddingTop: 16 }} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total Emissions"
                      stroke="#E02020"
                      fill="url(#co2-area)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Target Path"
                      stroke="#10B981"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted mt-4">
                Source: ELABORATOR emission model (COPERT 5.5) + traffic counts | Scope: Direct tailpipe emissions only
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Emissions by Transport Mode (June 2025)</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                    <Pie
                      data={emissionsByMode}
                      dataKey="value"
                      nameKey="name"
                      cx="45%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {emissionsByMode.map((e) => (
                        <Cell key={e.name} fill={e.color} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} kt/month`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
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
