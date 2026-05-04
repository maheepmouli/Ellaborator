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
  Legend,
  ComposedChart,
  Line,
  Area,
  ReferenceLine,
} from "recharts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const byGroup = [
  { segment: "Age 18-35", very: 35, satisfied: 42, neutral: 15, dis: 8 },
  { segment: "Age 36-55", very: 28, satisfied: 48, neutral: 18, dis: 6 },
  { segment: "Age 56+", very: 25, satisfied: 45, neutral: 20, dis: 10 },
  { segment: "Male", very: 30, satisfied: 45, neutral: 18, dis: 7 },
  { segment: "Female", very: 32, satisfied: 44, neutral: 17, dis: 7 },
  { segment: "Disabled", very: 40, satisfied: 38, neutral: 12, dis: 10 },
];

const monthly = [
  { m: "Jan", sat: 68 },
  { m: "Feb", sat: 71 },
  { m: "Mar", sat: 74 },
  { m: "Apr", sat: 76 },
  { m: "May", sat: 77 },
  { m: "Jun", sat: 78 },
];

const Satisfaction = () => {
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
            <h1 className="text-4xl font-bold text-red mb-2">User Satisfaction</h1>
            <p className="text-xl text-black">78% overall satisfaction</p>
            <p className="text-sm text-muted mt-2">Perception survey results for Milan mobility interventions (N=1,200)</p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">User Satisfaction by Demographic</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byGroup} margin={{ top: 12, right: 16, bottom: 32, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="segment" tick={{ fill: "#111" }} angle={-18} dy={12} interval={0} height={72} />
                    <YAxis tick={{ fill: "#111" }} domain={[0, 100]} name="Percentage (%)" />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <Legend wrapperStyle={{ paddingTop: 12 }} />
                    <Bar dataKey="very" name="Very Satisfied" stackId="a" fill="#10B981" />
                    <Bar dataKey="satisfied" name="Satisfied" stackId="a" fill="#38BDF8" />
                    <Bar dataKey="neutral" name="Neutral" stackId="a" fill="#6B7280" />
                    <Bar dataKey="dis" name="Dissatisfied" stackId="a" fill="#E02020" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted mt-4">
                Source: ELABORATOR intercept survey (June 2025) | Sample: Stratified random (margin of error ±2.8%)
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Overall Satisfaction Trend</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthly} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="m" tick={{ fill: "#111" }} />
                    <YAxis tick={{ fill: "#111" }} domain={[60, 85]} name="Satisfaction (%)" />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <Legend />
                    <ReferenceLine y={75} stroke="#6B7280" strokeDasharray="4 4" label={{ value: "Target 75%", fill: "#6B7280", position: "right" }} />
                    <Area type="monotone" dataKey="sat" stroke="none" fill="rgba(16, 185, 129, 0.15)" />
                    <Line type="monotone" dataKey="sat" name="Satisfaction" stroke="#10B981" strokeWidth={2} dot />
                  </ComposedChart>
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
            <h3 className="text-lg font-bold text-red mb-3">Survey Insights</h3>
            <ul className="space-y-2 text-black">
              <li>• Overall satisfaction at 78%, exceeding 75% target threshold</li>
              <li>• Persons with disabilities report highest &quot;Very Satisfied&quot; rate (40%)</li>
              <li>• Satisfaction increased 10pp from Jan (68%) to Jun (78%), indicating positive trend</li>
              <li>• Younger cohort (18-35) shows 77% combined positive satisfaction</li>
              <li>• Top improvement requests: more shaded seating, better wayfinding signage</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default Satisfaction;
