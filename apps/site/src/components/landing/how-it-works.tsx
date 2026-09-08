import { motion } from "framer-motion";
import { SectionHeading } from "./section-heading";
import { UserPlus, PackagePlus, ShoppingBag } from "lucide-react";

const steps = [
  { n: "01", icon: UserPlus, title: "Create your store", desc: "Sign up in 60 seconds and generate your store reference code." },
  { n: "02", icon: PackagePlus, title: "Add products & stock", desc: "Bulk import or scan barcodes to populate inventory across branches." },
  { n: "03", icon: ShoppingBag, title: "Customers order anywhere", desc: "Accept orders from mobile app or in-store POS — all in sync." },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-24 bg-muted/40">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading eyebrow="How it works" title={<>Up and running in <span className="text-gradient">three steps.</span></>} />
        <div className="grid gap-6 md:grid-cols-3 relative">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-border" />
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative rounded-xl border border-border bg-card p-8 text-center shadow-card"
            >
              <div className="relative mx-auto h-14 w-14 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <s.icon className="h-6 w-6" />
              </div>
              <div className="mt-4 text-xs tracking-widest text-muted-foreground">STEP {s.n}</div>
              <h3 className="mt-2 font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
