import { motion } from "framer-motion";
import { Search, FileText, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const KPIs = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const kpis = [
    {
      id: "mode-share",
      code: "KPI_MS",
      name: "Car Mode Share Change",
      category: "Mobility",
      unit: "percentage points",
      frequency: "Monthly",
      definition: "Change in proportion of trips made by private car vs baseline",
      methodology: "GPS tracking + revealed preference survey methodology",
      color: "bg-violet/10 text-violet border-violet/30",
      gradient: "from-violet/10 to-blue/10",
    },
    {
      id: "fsi-reduction",
      code: "KPI_FSI",
      name: "Fatal & Serious Injury Reduction",
      category: "Safety",
      unit: "percentage",
      frequency: "Annual (20-year projection)",
      definition: "Projected reduction in fatal and serious injuries from road collisions",
      methodology: "iRAP Star Rating model + historical collision data",
      color: "bg-purple/10 text-purple border-purple/30",
      gradient: "from-purple/10 to-violet/10",
    },
    {
      id: "co2-reduction",
      code: "KPI_CO2",
      name: "CO₂ Emissions Reduction",
      category: "Environment",
      unit: "percentage",
      frequency: "Monthly",
      definition: "Reduction in transport-related carbon dioxide emissions",
      methodology: "COPERT 5.5 emission factors + traffic volume measurements",
      color: "bg-green/20 text-purple border-green/30",
      gradient: "from-green/20 to-blue/10",
    },
    {
      id: "accessibility",
      code: "KPI_ACC",
      name: "Accessibility Features",
      category: "Accessibility",
      unit: "count",
      frequency: "Quarterly",
      definition: "Number of universal design features deployed (tactile paving, ramps, etc.)",
      methodology: "Field audit against EN 17210 and WCAG 2.1 standards",
      color: "bg-blue/20 text-purple border-blue/30",
      gradient: "from-blue/20 to-lavender/10",
    },
    {
      id: "satisfaction",
      code: "KPI_SAT",
      name: "User Satisfaction",
      category: "Satisfaction",
      unit: "percentage",
      frequency: "Quarterly",
      definition: "Percentage of users rating interventions as satisfactory or better",
      methodology: "Stratified intercept surveys with demographic weighting",
      color: "bg-green/20 text-purple border-green/30",
      gradient: "from-green/15 to-blue-light/20",
    },
    {
      id: "safety-stars",
      code: "KPI_STAR",
      name: "Pedestrian Safety Stars",
      category: "Safety",
      unit: "stars (1-5)",
      frequency: "Annual",
      definition: "iRAP safety rating for pedestrian infrastructure",
      methodology: "ViDA 4.2 assessment protocol with speed and design audit",
      color: "bg-lavender/20 text-purple border-lavender/30",
      gradient: "from-lavender/15 to-violet/10",
    },
  ];

  const categories = Array.from(new Set(kpis.map((k) => k.category)));

  const filteredKPIs = kpis.filter((kpi) => {
    const matchesSearch =
      kpi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kpi.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || kpi.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-violet/5 to-green/5">
      <Header />

      <main className="container mx-auto px-4 pt-24 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-purple mb-2">Key Performance Indicators</h1>
            <p className="text-lg text-muted-foreground">
              Catalogue of metrics used to evaluate urban mobility interventions
            </p>
          </div>

          {/* Search & Filters */}
          <div className="mb-8 space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search KPIs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/80 backdrop-blur-xl border-border-color/50"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className={selectedCategory === null ? "bg-violet text-primary-foreground" : "bg-card/80 backdrop-blur-xl"}
              >
                All Categories
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className={selectedCategory === cat ? "bg-violet text-primary-foreground" : "bg-card/80 backdrop-blur-xl"}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredKPIs.map((kpi, index) => (
              <motion.div
                key={kpi.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={`/kpi/${kpi.id}`}>
                  <div className={`group relative rounded-2xl border border-border-color/50 bg-gradient-to-br ${kpi.gradient} backdrop-blur-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:border-violet/50`}>
                    {/* Category Badge */}
                    <Badge className={`mb-4 ${kpi.color} border`}>
                      {kpi.category}
                    </Badge>

                    {/* KPI Info */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-purple mb-1">{kpi.name}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{kpi.code}</p>
                    </div>

                    {/* Definition */}
                    <p className="text-sm text-foreground mb-4 line-clamp-2">
                      {kpi.definition}
                    </p>

                    {/* Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Unit:</span>
                        <span className="text-foreground">{kpi.unit}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Frequency:</span>
                        <span className="text-foreground">{kpi.frequency}</span>
                      </div>
                    </div>

                    {/* View Button */}
                    <Button
                      variant="outline"
                      className="w-full group-hover:bg-violet group-hover:text-primary-foreground group-hover:border-violet transition-colors bg-card/50"
                    >
                      View Details
                    </Button>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Empty State */}
          {filteredKPIs.length === 0 && (
            <div className="text-center py-12 rounded-2xl border border-border-color/50 bg-card/80 backdrop-blur-xl">
              <p className="text-muted-foreground">No KPIs match your filters.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(null);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default KPIs;
