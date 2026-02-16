import { motion } from "framer-motion";
import { Mail, Github, Users, Shield, FileText, Lightbulb } from "lucide-react";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";

const About = () => {
  const faqs = [
    {
      q: "How often is data updated?",
      a: "Most KPIs update monthly; safety stars and accessibility audits update quarterly or annually depending on methodology requirements.",
    },
    {
      q: "What if data is missing for my city?",
      a: "We prioritize data completeness but some interventions may have gaps. Missing values are clearly marked with data quality flags.",
    },
    {
      q: "Can I download the raw data?",
      a: "Yes — use Export buttons on charts/tables to get CSV/JSON. Full datasets available on request for research purposes.",
    },
    {
      q: "How do you ensure data privacy?",
      a: "All individual-level data is aggregated before display. No PII is stored or shown. GPS data uses anonymized IDs with consent.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-light/10 to-green/10">
      <Header />

      <main className="container mx-auto px-4 pt-24 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          {/* Hero */}
          <div className="mb-12 text-center rounded-2xl border border-violet/20 bg-gradient-to-br from-violet/10 via-card/80 to-green/10 backdrop-blur-xl p-12 shadow-lg">
            <div className="flex justify-center mb-6">
              <Logo className="w-24 h-24 text-violet" />
            </div>
            <h1 className="text-5xl font-bold text-purple mb-4">ELABORATOR</h1>
            <p className="text-xl text-foreground max-w-2xl mx-auto">
              Evidence-based mobility analysis platform for cities and transport professionals
            </p>
          </div>

          {/* What We Do */}
          <div className="mb-8 rounded-2xl border border-border-color/50 bg-card/80 backdrop-blur-xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-violet/20 to-blue/20 rounded-lg">
                <Lightbulb className="h-6 w-6 text-violet" />
              </div>
              <h2 className="text-2xl font-bold text-purple">What This Platform Does</h2>
            </div>
            <div className="space-y-4 text-foreground">
              <p>
                <strong className="text-violet">For citizens:</strong> ELABORATOR shows how urban mobility interventions
                (pedestrian zones, bike lanes, traffic calming) affect your city — cleaner air,
                safer streets, better access for all.
              </p>
              <p>
                <strong className="text-green">For experts:</strong> A comprehensive evaluation toolkit with standardized
                KPIs, methodology transparency, cross-city comparisons, and downloadable data for
                policy-making and research.
              </p>
            </div>
          </div>

          {/* Methodology */}
          <div className="mb-8 rounded-2xl border border-border-color/50 bg-card/80 backdrop-blur-xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-blue/20 to-lavender/20 rounded-lg">
                <FileText className="h-6 w-6 text-blue" />
              </div>
              <h2 className="text-2xl font-bold text-purple">Methodology Overview</h2>
            </div>
            <p className="text-foreground mb-4">
              ELABORATOR uses internationally recognized methods to measure urban mobility
              outcomes:
            </p>
            <ul className="space-y-2 text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-violet font-bold">•</span>
                <span>
                  <strong>Modal share:</strong> GPS tracking + revealed preference surveys (sample
                  size ≥1,500 per intervention)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet font-bold">•</span>
                <span>
                  <strong>Safety:</strong> iRAP Star Rating for infrastructure + historical
                  collision analysis with 20-year projections
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet font-bold">•</span>
                <span>
                  <strong>Emissions:</strong> COPERT 5.5 emission factors applied to traffic volume
                  measurements
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet font-bold">•</span>
                <span>
                  <strong>Accessibility:</strong> Field audits against EN 17210 (European) and WCAG
                  2.1 Level AA (web) standards
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet font-bold">•</span>
                <span>
                  <strong>Satisfaction:</strong> Stratified intercept surveys with demographic
                  weighting (margin of error ≤3%)
                </span>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              Detailed definitions, formulas, and quality notes available on each KPI detail page.
            </p>
          </div>

          {/* Privacy & Ethics */}
          <div className="mb-8 rounded-2xl border border-border-color/50 bg-card/80 backdrop-blur-xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-green/20 to-blue/20 rounded-lg">
                <Shield className="h-6 w-6 text-green" />
              </div>
              <h2 className="text-2xl font-bold text-purple">Privacy & Ethics</h2>
            </div>
            <ul className="space-y-2 text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green font-bold">•</span>
                <span>
                  No personally identifiable information (PII) is collected, stored, or displayed
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green font-bold">•</span>
                <span>
                  GPS tracking uses anonymized device IDs with informed consent; data retained max
                  24 hours
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green font-bold">•</span>
                <span>
                  All metrics aggregated to city/intervention level before visualization
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green font-bold">•</span>
                <span>GDPR-compliant data handling with annual third-party audits</span>
              </li>
            </ul>
          </div>

          {/* Credits */}
          <div className="mb-8 rounded-2xl border border-border-color/50 bg-card/80 backdrop-blur-xl p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-lavender/20 to-violet/20 rounded-lg">
                <Users className="h-6 w-6 text-lavender" />
              </div>
              <h2 className="text-2xl font-bold text-purple">Credits & Partners</h2>
            </div>
            <div className="space-y-3 text-foreground">
              <p>
                <strong className="text-violet">Project Partners:</strong> European Commission Horizon Europe, iRAP, TomTom
                Traffic, COPERT, local municipalities
              </p>
              <p>
                <strong className="text-blue">Data Sources:</strong> National collision databases, municipal traffic
                counts, GPS fleet data, citizen surveys, field audits
              </p>
              <p>
                <strong className="text-green">Technology:</strong> Built with React, TypeScript, Tailwind CSS, Leaflet,
                ECharts
              </p>
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-8 rounded-2xl border border-border-color/50 bg-card/80 backdrop-blur-xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-purple mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-border-color/50 pb-4 last:border-0">
                  <h3 className="font-bold text-foreground mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="rounded-2xl border-2 border-violet/30 bg-gradient-to-r from-violet/10 to-green/10 backdrop-blur-xl p-8">
            <h2 className="text-2xl font-bold text-purple mb-4">Contact & Resources</h2>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3 bg-card/50 hover:bg-violet hover:text-primary-foreground" asChild>
                <a href="mailto:info@elaborator.eu">
                  <Mail className="h-4 w-4" />
                  info@elaborator.eu
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 bg-card/50 hover:bg-violet hover:text-primary-foreground" asChild>
                <a
                  href="https://github.com/elaborator"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4" />
                  GitHub Repository
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default About;
