import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const projection = [
  { year: "2025", baseline: 120, intervention: 120, ci: 120 },
  { year: "2027", baseline: 118, intervention: 112, ci: 115 },
  { year: "2029", baseline: 116, intervention: 105, ci: 110 },
  { year: "2031", baseline: 115, intervention: 98, ci: 105 },
  { year: "2033", baseline: 113, intervention: 92, ci: 100 },
  { year: "2035", baseline: 112, intervention: 87, ci: 95 },
  { year: "2037", baseline: 110, intervention: 83, ci: 91 },
  { year: "2039", baseline: 109, intervention: 80, ci: 88 },
  { year: "2041", baseline: 108, intervention: 77, ci: 85 },
  { year: "2043", baseline: 107, intervention: 75, ci: 83 },
  { year: "2045", baseline: 105, intervention: 73, ci: 81 },
];

const monthly = [
  { m: "Jan", red: 2.5 },
  { m: "Feb", red: 5.1 },
  { m: "Mar", red: 8.3 },
  { m: "Apr", red: 10.2 },
  { m: "May", red: 11.8 },
  { m: "Jun", red: 12.5 },
];

const FSIReduction = () => {
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
            <h1 className="text-4xl font-bold text-red mb-2">FSI Reduction (20-Year)</h1>
            <p className="text-xl text-black">+12.5% reduction vs baseline</p>
            <p className="text-sm text-muted mt-2">
              Projected impact of safe streets interventions on fatal and serious injuries
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Fatal &amp; Serious Injury Reduction (20-Year Projection)</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projection} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="year" tick={{ fill: "#111" }} />
                    <YAxis tick={{ fill: "#111" }} name="Annual FSI Count" />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <Legend wrapperStyle={{ paddingTop: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="baseline"
                      name="Baseline"
                      stroke="#6B7280"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line type="monotone" dataKey="intervention" name="With Intervention" stroke="#E02020" strokeWidth={2} dot />
                    <Line
                      type="monotone"
                      dataKey="ci"
                      name="Confidence band (upper)"
                      stroke="rgba(224, 32, 32, 0.45)"
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="2 2"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted mt-4">
                Source: iRAP Star Rating + ELABORATOR collision data | Model: Exponential decay with 95% CI (upper trace
                shown)
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Monthly FSI Reduction Progress</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    <defs>
                      <linearGradient id="fsi-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E02020" />
                        <stop offset="100%" stopColor="#C31414" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="m" tick={{ fill: "#111" }} />
                    <YAxis tick={{ fill: "#111" }} name="Reduction (%)" />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="red" name="FSI Reduction" fill="url(#fsi-bar)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-red/20 bg-red/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Key Findings</h3>
            <ul className="space-y-2 text-black">
              <li>• Intervention package achieves 12.5% FSI reduction in first 6 months</li>
              <li>• 20-year projection shows 30% cumulative reduction vs baseline trajectory</li>
              <li>• Confidence band (±8%) accounts for traffic volume variation and reporting uncertainty</li>
              <li>• Aligns with Vision Zero targets and iRAP 4-star road safety standards</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default FSIReduction;
