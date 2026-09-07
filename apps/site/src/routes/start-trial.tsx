import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/landing/theme-provider";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { StartTrialPage } from "@/components/landing/start-trial-page";
import { subscriptionTypeFromSlug } from "@/lib/ims-api";

type StartTrialSearch = {
  plan?: string;
};

export const Route = createFileRoute("/start-trial")({
  validateSearch: (search: Record<string, unknown>): StartTrialSearch => ({
    plan: typeof search.plan === "string" ? search.plan : undefined,
  }),
  component: StartTrialRoute,
  head: () => ({
    meta: [
      { title: "Start free trial — Shopynn" },
      {
        name: "description",
        content: "Create your Shopynn business account in minutes. Inventory, ordering, and POS in one platform.",
      },
    ],
    links: [{ rel: "canonical", href: "/start-trial" }],
  }),
});

function StartTrialRoute() {
  const { plan } = Route.useSearch();
  const initialSubscriptionType = subscriptionTypeFromSlug(plan);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="pt-28 pb-16">
          <StartTrialPage initialSubscriptionType={initialSubscriptionType} planSlug={plan} />
        </main>
        <Footer />
        <Toaster position="top-center" />
      </div>
    </ThemeProvider>
  );
}
