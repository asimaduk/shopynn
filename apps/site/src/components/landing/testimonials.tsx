import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { SectionHeading } from "./section-heading";

const items = [
  { name: "Amara Okafor", role: "Owner, Lagos Provisions", quote: "Shopynn cut our stockouts by 80%. Customers now order from the app while we sleep — and we wake up to fulfilled orders." },
  { name: "Daniel Reyes", role: "Founder, BlueCart Mart", quote: "We replaced three tools with Shopynn. Our checkout is twice as fast and the analytics finally make sense to me." },
  { name: "Priya Sharma", role: "Ops, Harvest Foods", quote: "Multi-branch sync is flawless. The mobile app feels premium — our customers actually compliment it." },
  { name: "Marcus Lee", role: "CTO, Urban Mart", quote: "API-first, dependable, and the support team ships features we ask for. Best inventory platform we've used." },
  { name: "Sara Fischer", role: "Manager, Freshly", quote: "Onboarding took an afternoon. By day two, the low-stock alerts had already paid for the year." },
  { name: "Tomás Alvarez", role: "Owner, Northwind Co.", quote: "Beautiful dashboards aside, the barcode scanning workflow is the fastest I've seen anywhere." },
];

export function Testimonials() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Loved by retailers"
          title={<>Real results from <span className="text-gradient">real businesses.</span></>}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="rounded-[5px] glass p-6 flex flex-col"
            >
              <div className="flex gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed">"{t.quote}"</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-brand grid place-items-center text-primary-foreground text-sm font-semibold">
                  {t.name.split(" ").map((n) => n[0]).join("")}
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
