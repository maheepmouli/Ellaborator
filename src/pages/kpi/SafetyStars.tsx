import { motion } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ReferenceLine,
  LabelList,
} from "recharts";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const radarRows = [
  { mode: "Pedestrian", current: 3.5, target: 4 },
  { mode: "Cyclist", current: 3.2, target: 4 },
  { mode: "Motorcyclist", current: 2.8, target: 4 },
  { mode: "Vehicle Occupant", current: 4.1, target: 4 },
];

const speedRows = [
  { type: "Residential", km: 28, limit: 30 },
  { type: "Collector", km: 42, limit: 50 },
  { type: "Arterial", km: 58, limit: 60 },
  { type: "School Zone", km: 24, limit: 30 },
];

const SafetyStars = () => {
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
            <h1 className="text-4xl font-bold text-red mb-2">Pedestrian Safety Stars</h1>
            <p className="text-xl text-black">3.5 ⭐ safety rating</p>
            <p className="text-sm text-muted mt-2">iRAP-based road safety assessment for Milan intervention corridors</p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">Safety Star Ratings by Mode</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="52%" outerRadius="72%" data={radarRows}>
                    <PolarGrid stroke="#cbd5e1" />
                    <PolarAngleAxis dataKey="mode" tick={{ fill: "#111", fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} tick={{ fill: "#64748b" }} />
                    <Radar name="Current" dataKey="current" stroke="#E02020" fill="rgba(224, 32, 32, 0.22)" strokeWidth={2} />
                    <Radar
                      name="Target (4-Star)"
                      dataKey="target"
                      stroke="#10B981"
                      fill="transparent"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted mt-4">
                Source: iRAP ViDA v4.2 | Assessment: 12 km of intervention routes | Date: May 2025
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-red">85th Percentile Speed by Street Type</h2>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={speedRows} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="type" tick={{ fill: "#111" }} />
                    <YAxis tick={{ fill: "#111" }} name="Speed (km/h)" domain={[0, 70]} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb" }} />
                    <ReferenceLine y={30} stroke="#6B7280" strokeDasharray="4 4" label={{ value: "30", position: "right", fill: "#6B7280" }} />
                    <ReferenceLine y={50} stroke="#6B7280" strokeDasharray="4 4" label={{ value: "50", position: "right", fill: "#6B7280" }} />
                    <Bar dataKey="km" name="85th %ile Speed" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="km" position="top" formatter={(v: number) => `${v} km/h`} />
                      {speedRows.map((e, i) => (
                        <Cell key={`c-${i}`} fill={e.km <= e.limit ? "#10B981" : "#E02020"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted mt-4">
                Green bars indicate compliance with posted limits. Red indicates exceeding limit.
              </p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-red/20 bg-red/5 p-6"
          >
            <h3 className="text-lg font-bold text-red mb-3">Safety Assessment Summary</h3>
            <ul className="space-y-2 text-black">
              <li>• Average pedestrian safety rating: 3.5 stars (0.5 stars below 4-star target)</li>
              <li>• Vehicle occupants achieve 4.1 stars (infrastructure design priority effective)</li>
              <li>• Motorcyclist rating at 2.8 stars identified as improvement area</li>
              <li>• 85th percentile speeds within limits on 75% of assessed segments</li>
              <li>• Arterial roads require traffic calming to meet 4-star cyclist standard</li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default SafetyStars;
