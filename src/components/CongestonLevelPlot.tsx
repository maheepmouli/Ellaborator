import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const CongestionLevelPlot = () => {
  const monthlyData = [
    { month: "Jan", y2024: 23, y2023: 20 },
    { month: "Feb", y2024: 25, y2023: 23 },
    { month: "Mar", y2024: 23, y2023: 24 },
    { month: "Apr", y2024: 28, y2023: 23 },
    { month: "May", y2024: 29, y2023: 27 },
    { month: "Jun", y2024: 28, y2023: 26 },
    { month: "Jul", y2024: 30, y2023: 24 },
    { month: "Aug", y2024: 16, y2023: 13 },
    { month: "Sep", y2024: 28, y2023: 26 },
    { month: "Oct", y2024: 30, y2023: 28 },
    { month: "Nov", y2024: 28, y2023: 28 },
    { month: "Dec", y2024: 30, y2023: 27 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="rounded-2xl border-2 border-border-color bg-card p-8 shadow-lg"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="space-y-3">
          <p className="text-sm text-muted font-medium">World rank 2024</p>
          <h3 className="text-2xl font-bold text-ink">Congestion level</h3>
          <div className="flex items-center justify-center w-24 h-24 rounded-full bg-red">
            <span className="font-numbers text-4xl font-bold text-white">300</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted font-medium">Average congestion level</p>
          <div className="flex items-baseline gap-2">
            <span className="font-numbers text-6xl font-bold text-ink">26</span>
            <span className="font-numbers text-3xl text-muted">%</span>
          </div>
          <p className="text-sm">
            <span className="text-red font-semibold">2%</span>
            <span className="text-muted">p more than in 2023</span>
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted font-medium">Peak hours impact</p>
          <div className="flex items-baseline gap-2">
            <span className="font-numbers text-6xl font-bold text-ink">42</span>
            <span className="font-numbers text-3xl text-muted">%</span>
          </div>
          <p className="text-sm text-muted">Morning & evening peaks</p>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-bold text-ink mb-4">Monthly congestion level</h4>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fill: "#111" }} />
              <YAxis domain={[0, 35]} tick={{ fill: "#6B7280" }} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", borderColor: "#E5E7EB" }} cursor={{ fill: "#f9fafb" }} />
              <Legend wrapperStyle={{ paddingTop: 8 }} iconType="square" />
              <Bar dataKey="y2024" name="2024" fill="#E02020" radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="y2023" name="2023" fill="#D1D5DB" radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};

export default CongestionLevelPlot;
