import { Link } from "@tanstack/react-router";
import { Boxes, Twitter, Github, Linkedin, Apple, Play } from "lucide-react";
import { LANDING_SECTIONS, type LandingSectionHash } from "@/lib/landing-nav";

type FooterRoute = "/start-trial" | "/privacy" | "/terms" | "/security";

type FooterLink =
  | { label: string; hash: LandingSectionHash }
  | { label: string; to: FooterRoute }
  | { label: string; href: string };

const cols: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", hash: LANDING_SECTIONS.features },
      { label: "Pricing", hash: LANDING_SECTIONS.pricing },
      { label: "Mobile App", hash: LANDING_SECTIONS.mobile },
      { label: "FAQ", hash: LANDING_SECTIONS.faq },
    ],
  },
  { title: "Company", links: [{ label: "About", hash: LANDING_SECTIONS.top }] },
  {
    title: "Resources",
    links: [
      { label: "Contact", hash: LANDING_SECTIONS.contact },
      { label: "Start trial", to: "/start-trial" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Security", to: "/security" },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  if ("to" in link) {
    return (
      <Link to={link.to} className="hover:text-foreground">
        {link.label}
      </Link>
    );
  }
  if ("hash" in link) {
    return (
      <Link to="/" hash={link.hash} className="hover:text-foreground">
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.href} className="hover:text-foreground">
      {link.label}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link to="/" hash={LANDING_SECTIONS.top} className="flex items-center gap-2">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-brand">
                <Boxes className="h-4 w-4 text-primary-foreground" />
              </span>
              <span className="font-display text-lg font-semibold">Shopynn</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Inventory and customer ordering for modern retailers — built to scale from one store to a hundred.
            </p>
            <div className="mt-5 flex gap-2">
              <a href="#" className="h-9 w-9 grid place-items-center rounded-lg glass hover:bg-muted"><Twitter className="h-4 w-4" /></a>
              <a href="#" className="h-9 w-9 grid place-items-center rounded-lg glass hover:bg-muted"><Github className="h-4 w-4" /></a>
              <a href="#" className="h-9 w-9 grid place-items-center rounded-lg glass hover:bg-muted"><Linkedin className="h-4 w-4" /></a>
            </div>
            <div className="mt-5 flex gap-2">
              <a href="#" className="inline-flex items-center gap-2 rounded-lg glass px-3 py-2 text-xs hover:bg-muted"><Apple className="h-4 w-4" /> App Store</a>
              <a href="#" className="inline-flex items-center gap-2 rounded-lg glass px-3 py-2 text-xs hover:bg-muted"><Play className="h-4 w-4" /> Google Play</a>
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-sm font-semibold">{c.title}</div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <FooterLinkItem link={l} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Shopynn Inc. All rights reserved.</div>
          <div>hello@shopynn.app · +1 (555) 010-2030</div>
        </div>
      </div>
    </footer>
  );
}
