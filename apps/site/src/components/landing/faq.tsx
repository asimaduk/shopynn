import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";

const faqs = [
  {
    q: "What is Shopynn?",
    a: "Shopynn is an inventory and sales platform for retailers in Ghana. Track stock, record sales and purchases, manage expenses, and see GHS reports from web or mobile.",
  },
  {
    q: "How does customer ordering work?",
    a: "Depending on your plan, customers can browse your catalogue and place orders through your storefront or mobile experience. New orders appear in your Shopynn dashboard so your team can fulfil them quickly.",
  },
  {
    q: "Can I run more than one shop or warehouse?",
    a: "Yes. Higher plans support multiple branches with stock transfers, role-based access for staff, and consolidated reporting across locations.",
  },
  {
    q: "Does Shopynn work with Mobile Money?",
    a: "Shopynn is built for Ghanaian retail workflows including GHS pricing and MoMo-friendly payment flows. Exact payment options depend on your plan and setup — start a trial or contact us to confirm what fits your store.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. You can start on the Free trial to explore core inventory and sales features. No credit card is required to begin. Upgrade when you need more branches, users, or advanced tools.",
  },
  {
    q: "Can I import my existing products?",
    a: "Yes. You can add products manually or import via spreadsheet/CSV so you are not starting from a blank catalogue. Our team can help if your data needs cleanup.",
  },
  {
    q: "What if the internet is slow or drops?",
    a: "Shopynn is designed for real-world connectivity. Keep selling and recording work where offline-capable features are available; data syncs when the connection returns.",
  },
  {
    q: "How do I get help?",
    a: "Use Talk to us on this site, chat with us from the landing page, or email support. Paid plans include priority support. We typically reply within one business day.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-24 bg-background">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeading
          eyebrow="FAQ"
          title={
            <>
              Questions, <span className="text-gradient">answered.</span>
            </>
          }
        />
        <Accordion type="single" collapsible className="rounded-xl border border-border bg-card divide-y divide-border shadow-card">
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
