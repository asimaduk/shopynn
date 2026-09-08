import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/utils";
import { fetchPublicBillingCatalog, planPriceFromCatalog, type BillingCatalogGrouped } from "@/lib/ims-api";

const STATIC_PLANS = [
  {
    name: "Basic", price: "GHS 229", desc: "For new stores getting started.", plan: "basic",
    features: ["Up to 100 SKUs", "1 branch", "Customer ordering portal", "Basic analytics", "Email support"],
    cta: "Get Started",
  },
  {
    name: "Standard", price: "GHS 429", desc: "For growing retailers.", popular: true, plan: "standard",
    features: ["Unlimited SKUs", "Up to 5 branches", "Mobile ordering app", "Advanced analytics", "Barcode scanning & POS", "Priority support"],
    cta: "Start now",
  },
  {
    name: "Premium", price: "GHS 799", desc: "For established businesses.", plan: "premium",
    features: ["Unlimited SKUs", "Up to 15 branches", "White-label mobile app", "Real-time multi-location sync", "Advanced reporting", "Dedicated account manager"],
    cta: "Start now",
  },
  {
    name: "Enterprise", price: "Custom", desc: "For chains and franchises.", plan: null as string | null,
    features: ["Unlimited branches", "Custom integrations", "SAML SSO & RBAC", "Dedicated success manager", "99.99% uptime SLA"],
    cta: "Contact sales",
  },
];

export function Pricing() {
  const [catalog, setCatalog] = useState<BillingCatalogGrouped | null>(null);

  useEffect(() => {
    fetchPublicBillingCatalog().then(setCatalog);
  }, []);

  const plans = STATIC_PLANS.map((p) => ({
    ...p,
    price: p.plan ? planPriceFromCatalog(catalog, p.plan) : p.price,
  }));

  return (
    <section id="pricing" className="py-24 bg-muted/40">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Pricing"
          title={<>Simple plans that <span className="text-gradient">grow with you.</span></>}
          subtitle="14-day free trial on every plan. No credit card required."
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "relative rounded-xl p-8 flex flex-col border shadow-card",
                p.popular
                  ? "border-primary/40 bg-card ring-1 ring-primary/20"
                  : "border-border bg-card",
              )}
            >
              {p.popular && (
                <div className="absolute -top-3 right-6 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground rounded-full px-3 py-1">
                  Most popular
                </div>
              )}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="text-sm mt-1 text-muted-foreground">{p.desc}</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="font-display text-4xl font-semibold">{p.price}</span>
                {p.price !== "Custom" && <span className="text-sm pb-1.5 text-muted-foreground">/month</span>}
              </div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
                asChild
              >
                {p.plan ? (
                  <Link to="/start-trial" search={{ plan: p.plan }}>
                    {p.cta}
                  </Link>
                ) : (
                  <a href="#contact">{p.cta}</a>
                )}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
