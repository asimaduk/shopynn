import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/landing/theme-provider";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { MobileApp } from "@/components/landing/mobile-app";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { CtaContact } from "@/components/landing/cta-contact";
import { Footer } from "@/components/landing/footer";
import { ChatWidget } from "@/components/landing/chat-widget";
import { useScrollToHash } from "@/components/landing/use-scroll-to-hash";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Shopynn — Inventory & Customer Ordering Platform" },
      { name: "description", content: "Manage inventory, orders and customers from anywhere. Real-time stock, mobile ordering, multi-branch POS — built for modern retailers." },
      { property: "og:title", content: "Shopynn — Inventory & Customer Ordering Platform" },
      { property: "og:description", content: "Real-time inventory, customer ordering portal, mobile app and POS in one platform." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Shopynn",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }),
    }],
  }),
});

function Index() {
  useScrollToHash();

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main>
          <Hero />
          <Stats />
          <Features />
          <HowItWorks />
          <DashboardPreview />
          <MobileApp />
          <Testimonials />
          <Pricing />
          <FAQ />
          <CtaContact />
        </main>
        <Footer />
        <ChatWidget />
        <Toaster position="top-center" />
      </div>
    </ThemeProvider>
  );
}
