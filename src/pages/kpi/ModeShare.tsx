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
} from "recharts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const beforeAfter = [
  { mode: "Car", Before: 45, After: 33 },
  { mode: "Public Transit", Before: 25, After: 30 },
  { mode: "Cycling", Before: 8, After: 15 },
  { mode: "Walking", Before: 18, After: 20 },
  { mode: "Other", Before: 4, After: 2 },
];

const carTrend = [
  { month: "Jan", share: 45 },
  { month: "Feb", share: 43 },
  { month: "Mar", share: 40 },
  { month: "Apr", share: 38 },
  { month: "May", share: 35 },
  { month: "Jun", share: 33 },
];

const ModeShare = () => {
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
            <h1 className="text-4xl font-bold text-red mb-2">Car Mode Share Change</h1>
            <p className="text-xl text-black">-12 percentage points vs baseline</p>
            <p className="text-sm text-muted mt-2">Analysis of modal shift interventions in Milan (2025-01 to 2025-06)</p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Modal Share Change: Before vs After Intervention</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export PNG
                </Button>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={beforeAfter} margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mode" tick={{ fill: "#111" }} />
                    <YAxis tick={{ fill: "#111" }} name="Mode Share (%)" />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <Legend wrapperStyle={{ paddingTop: 16 }} />
                    <Bar dataKey="Before" fill="#6B7280" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="After" fill="#E02020" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted mt-4">
                Source: ELABORATOR mobility survey (N=2,500) | Methodology: Revealed preference + GPS tracking
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Car Mode Share Trend Over Time</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={carTrend} margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fill: "#111" }} />
                    <YAxis tick={{ fill: "#111" }} domain={[30, 48]} name="Share (%)" />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <Legend />
                    <Area type="monotone" dataKey="share" stroke="none" fill="rgba(224, 32, 32, 0.1)" />
                    <Line type="monotone" dataKey="share" name="Car Share" stroke="#E02020" strokeWidth={2} dot />
                  </ComposedChart>
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
            <h3 className="text-lg font-bold text-red mb-3">Key Insights</h3>
            <ul className="space-y-2 text-black">
              <li>• Car mode share decreased from 45% to 33% (-12pp) following pedestrianization interventions</li>
              <li>• Public transit increased by 5pp, cycling by 7pp, demonstrating effective modal shift</li>
              <li>• Trend shows consistent decline, with steepest reduction in March-April period</li>
              <li>• Results align with TomTom Traffic Index methodology for urban mobility assessment</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default ModeShare;
