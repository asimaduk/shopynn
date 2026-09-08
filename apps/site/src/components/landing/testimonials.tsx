import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { SectionHeading } from "./section-heading";

const items = [
  {
    name: "Ama Mensah",
    role: "Owner, Circle Mart — Accra",
    quote:
      "Shopynn cut our stockouts almost overnight. Customers order on their phones and we wake up to sales already queued.",
  },
  {
    name: "Kwame Boateng",
    role: "Founder, Kumasi Fresh Foods",
    quote:
      "We used to juggle Excel and WhatsApp. Now inventory, sales, and purchases live in one place — and MoMo fits how we get paid.",
  },
  {
    name: "Akosua Darko",
    role: "Ops Lead, Takoradi Provisions",
    quote:
      "Multi-branch transfers finally make sense. My team in Takoradi and Accra see the same stock numbers.",
  },
  {
    name: "Yaw Asante",
    role: "Manager, Madina Wholesale",
    quote:
      "Barcode receiving is fast. End-of-day reports used to take hours — now I close the shop knowing the numbers are right.",
  },
  {
    name: "Efua Owusu",
    role: "Owner, Spintex Beauty Hub",
    quote:
      "Onboarding took one afternoon. Low-stock alerts already saved us from empty shelves on a busy weekend.",
  },
  {
    name: "Kofi Adjei",
    role: "Owner, Tema Cold Store",
    quote:
      "Clear dashboards, GHS totals, and a POS that works when the network dips. Exactly what our store needed.",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Loved by retailers"
          title={
            <>
              Real results from <span className="text-gradient">Ghanaian businesses.</span>
            </>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-border bg-card p-6 flex flex-col shadow-card"
            >
              <div className="flex gap-1 text-[var(--orange)]">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed text-foreground/90">"{t.quote}"</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-semibold">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="text-sm">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-muted-foreground text-xs">{t.role}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
