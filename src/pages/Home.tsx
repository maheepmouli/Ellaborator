import { motion } from "framer-motion";
import { MapPin, ArrowRight, Leaf, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4 }}
        className="pt-16"
      >
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex flex-col justify-center overflow-hidden bg-purple">
          {/* Animated Background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet/20 blur-3xl animate-pulse" />
            <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full bg-green/15 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-lavender/10 blur-3xl" />
          </div>

          <div className="relative z-10 container mx-auto px-6 py-16">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="max-w-4xl"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-green/20 rounded-xl backdrop-blur-sm border border-green/30">
                  <Leaf className="h-7 w-7 text-green" />
                </div>
                <span className="text-blue-light text-sm font-medium tracking-widest uppercase">
                  EU Horizon · CIVITAS Initiative
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-primary-foreground leading-[1.1] mb-8">
                Planning sustainable<br />
                <span className="text-green">mobility for all citizens</span>
              </h1>

              <p className="text-lg md:text-xl text-blue-light/90 max-w-2xl mb-12 leading-relaxed">
                Data on mobility interventions is increasingly open, but it remains difficult to use unless you're a data expert.
                <span className="text-primary-foreground font-medium"> ELABORATOR</span> transforms this data into interactive maps and allows everyone to understand how transportation affects daily life.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link to="/map">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative flex items-center gap-3 px-8 py-4 bg-green text-purple font-bold rounded-xl shadow-2xl shadow-green/30 hover:shadow-green/50 transition-all duration-300 overflow-hidden"
                  >
                    {/* Animated gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green via-blue-light to-green opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-[length:200%_100%] group-hover:animate-[shimmer_2s_infinite]" />
                    <MapPin className="h-5 w-5 relative z-10" />
                    <span className="relative z-10">Explore the Interactive Map</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform relative z-10" />
                  </motion.button>
                </Link>

                <Link
                  to="/about"
                  className="flex items-center gap-2 px-6 py-4 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/30 text-primary-foreground rounded-xl hover:bg-primary-foreground/20 transition-all duration-300 font-medium"
                >
                  Learn more about the tool
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <section className="py-8 bg-purple border-t border-primary-foreground/10">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-primary-foreground/60">
                © 2024 ELABORATOR · EU Horizon Project · CIVITAS Initiative
              </p>
              <div className="flex gap-6">
                <Link to="/about" className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                  About
                </Link>
                <a href="#" className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                  Privacy
                </a>
              </div>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default Home;
