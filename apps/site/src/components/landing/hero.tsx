import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Apple, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SIGN_IN_URL } from "@/lib/config";

export function Hero() {
  return (
    <section id="top" className="relative pt-28 pb-16 sm:pt-32 sm:pb-20 overflow-hidden" style={{ backgroundColor: "#faf9f7" }}>
      <div className="relative mx-auto max-w-6xl px-4 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full accent-dot" />
          Inventory · Orders · Sales · Reports
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.55 }}
          className="font-display mt-5 text-4xl sm:text-6xl md:text-[4.25rem] font-semibold leading-[1.05] tracking-tight text-foreground"
        >
          Manage inventory, orders <br className="hidden sm:block" />
          and customers <span className="text-gradient">from anywhere.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.55 }}
          className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          One platform to track stock in real time, sell in-store, and keep every branch in sync — built for Ghanaian retailers.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.55 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6" asChild>
            <Link to="/start-trial">
              Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-6" asChild>
            <a href={SIGN_IN_URL}>Login</a>
          </Button>
          <Button size="lg" variant="ghost" className="h-12 px-4 gap-2 text-muted-foreground" asChild>
            <a href="#mobile"><Apple className="h-4 w-4" /> / <Play className="h-4 w-4" /> Download App</a>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="relative mt-14 mx-auto max-w-5xl"
        >
          <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-card">
            <img
              src="/dashboard-hero.jpg"
              alt="Shopynn admin dashboard — sales overview and inventory navigation"
              width={1600}
              height={1024}
              className="w-full h-auto"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
