import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";

const faqs = [
  { q: "How does customer ordering work?", a: "Each store gets a branded web storefront and a mobile app where customers can browse products, place orders and pay securely. Orders flow into your dashboard in real time." },
  { q: "How do customers install the mobile app?", a: "They can scan the QR code on your storefront, or download from the App Store and Google Play directly. The app auto-detects their store on first launch." },
  { q: "What's included in subscription plans?", a: "All plans include the core inventory engine and ordering portal. Higher tiers unlock more branches, advanced analytics, POS, and priority support." },
  { q: "Do you support multiple stores or branches?", a: "Yes — Business and Enterprise plans support multi-branch with stock transfers, role-based access, and consolidated reporting." },
  { q: "Does it work offline?", a: "Yes. The POS and mobile app keep working offline; data syncs automatically when you're back online." },
  { q: "Can I migrate from another system?", a: "We support CSV import and have one-click migration tools from Shopify, Square and most popular POS systems. Our team can help with custom data." },
];

export function FAQ() {
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeading
          eyebrow="FAQ"
          title={<>Questions, <span className="text-gradient">answered.</span></>}
        />
        <Accordion type="single" collapsible className="rounded-[5px] glass divide-y divide-border">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={"i" + i} className="border-0 px-6">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-5">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
