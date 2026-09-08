import { motion } from "framer-motion";
import {
  Activity, ShoppingCart, Smartphone, BarChart3, Building2, ScanLine, BellRing, Zap,
} from "lucide-react";
import { SectionHeading } from "./section-heading";

const features = [
  { icon: Activity, title: "Real-time inventory", desc: "Live stock counts that update across every branch and channel instantly." },
  { icon: ShoppingCart, title: "Customer ordering portal", desc: "Branded web storefront where customers can browse and order directly." },
  { icon: Smartphone, title: "Mobile ordering app", desc: "Native iOS & Android apps with push notifications and live tracking." },
  { icon: BarChart3, title: "Sales analytics", desc: "Beautiful dashboards with cohorts, top SKUs, and forecast trends." },
  { icon: Building2, title: "Multi-branch support", desc: "Manage warehouses, stores and stock transfers from one place." },
  { icon: ScanLine, title: "Barcode scanning", desc: "Scan to receive, sell or audit — works with any USB or Bluetooth scanner." },
  { icon: BellRing, title: "Low stock alerts", desc: "Smart thresholds and AI predictions so you never run out again." },
  { icon: Zap, title: "Fast checkout / POS", desc: "Sub-second checkout, split payments, receipts, and offline mode." },
];

export function Features() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Features"
          title={<>Everything you need to run a <span className="text-gradient">modern store.</span></>}
          subtitle="From the warehouse to the customer's doorstep — Shopynn handles every step."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.04 }}
              className="group relative rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/25"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
