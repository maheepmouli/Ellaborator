import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const features = [
  { feature: "Tactile Paving", count: 12 },
  { feature: "Curb Ramps", count: 8 },
  { feature: "Audio Signals", count: 6 },
  { feature: "Wide Sidewalks", count: 5 },
  { feature: "Resting Benches", count: 7 },
  { feature: "Accessible Parking", count: 4 },
];

const districts = [
  { name: "Centro Storico", value: 14, color: "#E02020" },
  { name: "Porta Venezia", value: 11, color: "#C31414" },
  { name: "Brera", value: 9, color: "#38BDF8" },
  { name: "Ticinese", value: 8, color: "#6B7280" },
];

const Accessibility = () => {
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
            <h1 className="text-4xl font-bold text-red mb-2">Accessibility Features</h1>
            <p className="text-xl text-black">42 features mapped</p>
            <p className="text-sm text-muted mt-2">Universal design inventory for Milan intervention zones</p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Accessibility Features by Type</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={features} margin={{ top: 8, right: 48, bottom: 8, left: 112 }}>
                    <defs>
                      <linearGradient id="acc-bar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#E02020" />
                        <stop offset="100%" stopColor="#C31414" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#111" }} />
                    <YAxis type="category" dataKey="feature" width={108} tick={{ fill: "#111", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="count" name="Count" fill="url(#acc-bar)" radius={[0, 4, 4, 0]} label={{ fill: "#111", position: "right" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted mt-4">
                Source: ELABORATOR field audit (May 2025) | Standards: EN 17210, WCAG 2.1 Level AA
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Coverage by District</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={districts}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={130}
                      label={({ name, value, percent }) =>
                        `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                      }
                    >
                      {districts.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-sky/20 bg-sky/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Accessibility Highlights</h3>
            <ul className="space-y-2 text-black">
              <li>• 42 universal design features deployed across 4 districts</li>
              <li>• Tactile paving coverage: 12 key pedestrian crossings (100% of priority routes)</li>
              <li>• Audio signal installations at 6 high-traffic intersections</li>
              <li>• Centro Storico leads with 33% of total features (historic center focus)</li>
              <li>• Next phase: additional 18 features planned for Q3 2025</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default Accessibility;
