import { motion } from "framer-motion";
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
} from "recharts";

const ModalShareTrend = () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const carData = [45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 33];
  const publicTransitData = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42];
  const cyclingData = [15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20];
  const walkingData = [10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5];

  const data = months.map((month, i) => ({
    month,
    car: carData[i],
    transit: publicTransitData[i],
    cycling: cyclingData[i],
    walk: walkingData[i],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      className="rounded-2xl border-2 border-border-color bg-card p-8 shadow-lg"
    >
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-red mb-2">Modal Share Evolution 2024</h3>
        <p className="text-black">Monthly trends showing shift from car to sustainable modes</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-xs text-muted">Car Share</p>
          <p className="font-numbers text-3xl font-bold text-red">33%</p>
          <p className="text-xs text-emerald">↓ 12pp</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Public Transit</p>
          <p className="font-numbers text-3xl font-bold text-emerald">42%</p>
          <p className="text-xs text-emerald">↑ 12pp</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Cycling</p>
          <p className="font-numbers text-3xl font-bold text-sky">20%</p>
          <p className="text-xs text-emerald">↑ 5pp</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Walking</p>
          <p className="font-numbers text-3xl font-bold text-muted">5%</p>
          <p className="text-xs text-red">↓ 5pp</p>
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="car-area-modal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(224, 32, 32, 0.35)" />
                <stop offset="100%" stopColor="rgba(224, 32, 32, 0.05)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fill: "#111" }} />
            <YAxis tick={{ fill: "#6B7280" }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "rgba(255,255,255,0.95)", borderColor: "#E5E7EB", color: "#111" }}
              formatter={(value: number) => [`${value}%`, ""]}
            />
            <Legend wrapperStyle={{ paddingTop: 8 }} />
            <Area type="monotone" dataKey="car" stroke="none" fill="url(#car-area-modal)" legendType="none" />
            <Line type="monotone" dataKey="car" name="Car" stroke="#E02020" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="transit" name="Public Transit" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cycling" name="Cycling" stroke="#38BDF8" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="walk" name="Walking" stroke="#6B7280" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default ModalShareTrend;
