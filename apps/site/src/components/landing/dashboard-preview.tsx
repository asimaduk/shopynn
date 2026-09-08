import { motion } from "framer-motion";
import { SectionHeading } from "./section-heading";
const dashboard = "/dashboard-hero.jpg";

const tabs = ["Overview", "Inventory", "Orders", "Customers"];

export function DashboardPreview() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Dashboard"
          title={<>Beautifully simple. <span className="text-gradient">Powerfully detailed.</span></>}
          subtitle="A control center designed for speed and clarity — even on slow days, decisions are obvious."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[5px] glass overflow-hidden shadow-card"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <div className="ml-4 hidden sm:flex gap-1 text-xs">
              {tabs.map((t, i) => (
                <span key={t} className={"px-3 py-1 rounded-md " + (i === 0 ? "bg-gradient-brand text-primary-foreground" : "text-muted-foreground")}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="relative group">
            <img src={dashboard} alt="Shopynn analytics dashboard" loading="lazy" width={1600} height={1024} className="w-full h-auto group-hover:scale-[1.02] transition-transform duration-700" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
