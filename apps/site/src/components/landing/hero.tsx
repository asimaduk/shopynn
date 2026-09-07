import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Apple, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import dashboard from "@/assets/dashboard-hero.jpg";
import { SIGN_IN_URL } from "@/lib/config";

export function Hero() {
  return (
    <section id="top" className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-radial-brand pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-4 text-center">
        <motion.a
          href="#features"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-muted-foreground"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          New · AI-powered low-stock predictions
          <ArrowRight className="h-3 w-3" />
        </motion.a>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6 }}
          className="font-display mt-6 text-4xl sm:text-6xl md:text-7xl font-semibold leading-[1.05] tracking-tight"
        >
          Manage inventory, orders <br className="hidden sm:block" />
          and customers <span className="text-gradient">from anywhere.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          One platform to track stock in real-time, accept customer orders on web and mobile, and run multiple branches without missing a beat.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button size="lg" className="bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow h-12 px-6" asChild>
            <Link to="/start-trial">
              Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-6" asChild>
            <a href={SIGN_IN_URL}>Login</a>
          </Button>
          <Button size="lg" variant="ghost" className="h-12 px-4 gap-2" asChild>
            <a href="#mobile"><Apple className="h-4 w-4" /> / <Play className="h-4 w-4" /> Download App</a>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.8 }}
          className="relative mt-16 mx-auto max-w-5xl"
        >
          <div className="absolute -inset-6 bg-gradient-brand opacity-30 blur-3xl rounded-[2rem]" />
          <div className="relative rounded-[5px] overflow-hidden border border-border shadow-card glass">
            <img
              src={dashboard}
              alt="Shopynn dashboard preview showing inventory and analytics"
              width={1600}
              height={1024}
              className="w-full h-auto"
            />
          </div>

          {/* Floating cards */}
          <motion.div
            initial={{ opacity: 0, x: -20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.8 }}
            className="hidden md:flex absolute -left-6 top-1/3 glass rounded-xl px-4 py-3 shadow-card items-center gap-3"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-left">
              <div className="text-xs text-muted-foreground">Live orders</div>
              <div className="text-sm font-semibold">+128 today</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 1 }}
            className="hidden md:block absolute -right-6 bottom-12 glass rounded-xl px-4 py-3 shadow-card text-left"
          >
            <div className="text-xs text-muted-foreground">Revenue · 7d</div>
            <div className="text-sm font-semibold">$24,815 <span className="text-emerald-400 text-xs">↑ 12.4%</span></div>
          </motion.div>
        </motion.div>

        {/* Logos */}
        <div className="mt-16">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Trusted by 4,000+ retailers</p>
          <div className="mt-5 flex flex-wrap justify-center gap-x-10 gap-y-3 opacity-70">
            {["NORTHWIND", "ACME CO.", "FRESHLY", "URBAN MART", "BLUE CART", "HARVEST"].map((n) => (
              <span key={n} className="font-display text-sm tracking-[0.18em] text-muted-foreground">{n}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
