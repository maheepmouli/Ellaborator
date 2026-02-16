import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface KPICardProps {
  title: string;
  value: string;
  unit: string;
  change: string;
  to: string;
  compact?: boolean;
}

const KPICard = ({ title, value, unit, change, to, compact }: KPICardProps) => {
  if (compact) {
    return (
      <Link to={to} className="block h-full">
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ duration: 0.2 }}
          className="group relative h-full rounded-xl border border-border-color bg-card p-3 shadow-sm transition-all hover:shadow-lg hover:border-violet/30"
        >
          <h3 className="text-xs font-bold text-primary mb-2 truncate">{title}</h3>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="font-numbers text-2xl font-bold text-foreground">{value}</span>
            <span className="font-numbers text-sm text-muted-foreground">{unit}</span>
          </div>
          <p className="text-[10px] text-muted-foreground truncate">{change}</p>
          <div className="absolute bottom-2 right-2">
            <ArrowRight className="h-3 w-3 text-violet transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 gradient-primary rounded-b-xl opacity-0 transition-opacity group-hover:opacity-100" />
        </motion.div>
      </Link>
    );
  }

  return (
    <Link to={to}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ duration: 0.4 }}
        className="group relative h-full rounded-2xl border-2 border-border-color bg-card p-6 shadow-md transition-all hover:shadow-2xl hover:border-violet/30"
      >
        <h3 className="mb-6 text-lg font-bold text-primary">{title}</h3>
        <div className="mb-4 flex items-baseline gap-2">
          <span className="font-numbers text-5xl font-bold text-foreground">{value}</span>
          <span className="font-numbers text-2xl text-muted-foreground">{unit}</span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{change}</p>
        <div className="flex items-center justify-between border-t border-border-color pt-4">
          <span className="text-xs text-muted-foreground">Click to see chart</span>
          <ArrowRight className="h-4 w-4 text-violet transition-transform group-hover:translate-x-1" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 gradient-primary rounded-b-2xl opacity-0 transition-opacity group-hover:opacity-100" />
      </motion.div>
    </Link>
  );
};

export default KPICard;
