import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument, LegalPageShell } from "@/components/landing/legal-page-shell";
import { termsOfService } from "@/content/legal";

export const Route = createFileRoute("/terms")({
  component: TermsRoute,
  head: () => ({
    meta: [
      { title: "Terms of Service — Shopynn" },
      { name: "description", content: "Terms governing use of the Shopynn platform and website." },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
});

function TermsRoute() {
  return (
    <LegalPageShell>
      <LegalDocument {...termsOfService} />
    </LegalPageShell>
  );
}
