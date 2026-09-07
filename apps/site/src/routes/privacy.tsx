import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument, LegalPageShell } from "@/components/landing/legal-page-shell";
import { privacyPolicy } from "@/content/legal";

export const Route = createFileRoute("/privacy")({
  component: PrivacyRoute,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Shopynn" },
      { name: "description", content: "How Shopynn collects, uses, and protects personal data." },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
});

function PrivacyRoute() {
  return (
    <LegalPageShell>
      <LegalDocument {...privacyPolicy} />
    </LegalPageShell>
  );
}
