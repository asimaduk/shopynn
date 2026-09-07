import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument, LegalPageShell } from "@/components/landing/legal-page-shell";
import { securityPage } from "@/content/legal";

export const Route = createFileRoute("/security")({
  component: SecurityRoute,
  head: () => ({
    meta: [
      { title: "Security — Shopynn" },
      { name: "description", content: "How Shopynn protects your business data and platform access." },
    ],
    links: [{ rel: "canonical", href: "/security" }],
  }),
});

function SecurityRoute() {
  return (
    <LegalPageShell>
      <LegalDocument {...securityPage} />
    </LegalPageShell>
  );
}
