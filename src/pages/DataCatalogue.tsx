import { motion } from "framer-motion";
import { Download, Eye } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const DataCatalogue = () => {
  const catalogueData = [
    {
      category: "Mobility",
      mainStat: "Car Mode Share",
      secondaryStats: "By demographic, time, route",
      filters: "City, Intervention, Date, Mode",
      vizType: "Bar, Line, Heatmap",
      source: "GPS tracking + surveys (N=2,500)",
    },
    {
      category: "Safety",
      mainStat: "FSI Count",
      secondaryStats: "By severity, user type, location",
      filters: "City, Intervention, Date, User Type",
      vizType: "Line, Pie, Map",
      source: "National collision database",
    },
    {
      category: "Environment",
      mainStat: "CO₂ Emissions",
      secondaryStats: "By mode, time series, target path",
      filters: "City, Intervention, Date, Mode",
      vizType: "Line, Area, Bar",
      source: "COPERT 5.5 + traffic counts",
    },
    {
      category: "Accessibility",
      mainStat: "Feature Count",
      secondaryStats: "By type, district, compliance",
      filters: "City, Feature Type, Standard",
      vizType: "Bar, Pie, Map",
      source: "Field audit (EN 17210, WCAG 2.1)",
    },
    {
      category: "Satisfaction",
      mainStat: "User Rating",
      secondaryStats: "By demographic, intervention, trend",
      filters: "City, Demographic, Date",
      vizType: "Stacked Bar, Line",
      source: "Intercept surveys (N=1,200)",
    },
    {
      category: "Safety",
      mainStat: "Safety Stars",
      secondaryStats: "By user type, speed compliance",
      filters: "City, User Type, Road Type",
      vizType: "Radar, Bar",
      source: "iRAP ViDA 4.2 assessment",
    },
  ];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Mobility: "bg-violet/20 text-violet border-violet/30",
      Safety: "bg-purple/20 text-purple border-purple/30",
      Environment: "bg-green/30 text-purple border-green/40",
      Accessibility: "bg-blue/30 text-purple border-blue/40",
      Satisfaction: "bg-lavender/30 text-purple border-lavender/40",
    };
    return colors[category] || "bg-muted/10 text-muted border-muted/20";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-lavender/5 to-blue/5">
      <Header />

      <main className="container mx-auto px-4 pt-24 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-purple mb-2">Data Catalogue</h1>
              <p className="text-lg text-muted-foreground">
                Transparent mapping from raw data collection to final visualizations
              </p>
            </div>
            <Button variant="outline" className="gap-2 bg-card/80 backdrop-blur-xl hover:bg-violet hover:text-primary-foreground">
              <Download className="h-4 w-4" />
              Export Catalogue
            </Button>
          </div>

          {/* Data Flow Explainer */}
          <div className="mb-8 rounded-2xl border border-border-color/50 bg-card/80 backdrop-blur-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-purple mb-4">How We Transform Data</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <div className="rounded-xl bg-gradient-to-br from-violet/10 to-blue/10 border border-violet/20 p-4 text-center">
                  <div className="text-2xl font-bold text-violet mb-1">1</div>
                  <div className="text-sm font-semibold text-foreground mb-1">Raw Collection</div>
                  <div className="text-xs text-muted-foreground">
                    GPS, surveys, sensors, audits
                  </div>
                </div>
                <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-violet"></div>
              </div>

              <div className="relative">
                <div className="rounded-xl bg-gradient-to-br from-blue/10 to-lavender/10 border border-blue/20 p-4 text-center">
                  <div className="text-2xl font-bold text-blue mb-1">2</div>
                  <div className="text-sm font-semibold text-foreground mb-1">Clean & Validate</div>
                  <div className="text-xs text-muted-foreground">
                    Quality checks, standardization
                  </div>
                </div>
                <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-blue"></div>
              </div>

              <div className="relative">
                <div className="rounded-xl bg-gradient-to-br from-lavender/10 to-green/10 border border-lavender/20 p-4 text-center">
                  <div className="text-2xl font-bold text-lavender mb-1">3</div>
                  <div className="text-sm font-semibold text-foreground mb-1">Compute KPIs</div>
                  <div className="text-xs text-muted-foreground">
                    Apply methodology, aggregate
                  </div>
                </div>
                <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-lavender"></div>
              </div>

              <div>
                <div className="rounded-xl bg-gradient-to-br from-green/10 to-violet/10 border border-green/30 p-4 text-center">
                  <div className="text-2xl font-bold text-green mb-1">4</div>
                  <div className="text-sm font-semibold text-foreground mb-1">Visualize</div>
                  <div className="text-xs text-muted-foreground">
                    Charts, maps, dashboards
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Catalogue Table */}
          <div className="rounded-2xl border border-border-color/50 bg-card/80 backdrop-blur-xl shadow-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-violet/5 to-blue/5">
                  <TableHead className="font-bold text-purple">Category</TableHead>
                  <TableHead className="font-bold text-purple">Main Stat</TableHead>
                  <TableHead className="font-bold text-purple">Secondary Stats</TableHead>
                  <TableHead className="font-bold text-purple">Filters</TableHead>
                  <TableHead className="font-bold text-purple">Visualization</TableHead>
                  <TableHead className="font-bold text-purple">Data Source</TableHead>
                  <TableHead className="font-bold text-purple">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogueData.map((row, index) => (
                  <TableRow key={index} className="hover:bg-violet/5 transition-colors">
                    <TableCell>
                      <Badge className={`${getCategoryColor(row.category)} border`}>
                        {row.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {row.mainStat}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {row.secondaryStats}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.filters}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {row.vizType}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">
                      {row.source}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="gap-2 hover:bg-violet/10 hover:text-violet">
                        <Eye className="h-3 w-3" />
                        Preview
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Privacy Note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border-2 border-green/30 bg-gradient-to-r from-green/10 to-blue/10 backdrop-blur-xl p-6"
          >
            <h3 className="text-lg font-bold text-purple mb-3">Data Privacy & Ethics</h3>
            <ul className="space-y-2 text-foreground text-sm">
              <li>
                • All individual-level data is aggregated before visualization — no personally
                identifiable information (PII) is displayed
              </li>
              <li>
                • GPS tracking uses anonymized device IDs with informed consent and 24-hour
                retention limits
              </li>
              <li>
                • Survey responses are stored separately from demographic identifiers and linked
                via one-way hash
              </li>
              <li>
                • Data quality indicators show freshness, sample size, and known limitations for
                each metric
              </li>
            </ul>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default DataCatalogue;
