/** Section ids on the home page — use with `Link to="/" hash={...}` from any route. */
export const LANDING_SECTIONS = {
  top: "top",
  features: "features",
  how: "how",
  mobile: "mobile",
  pricing: "pricing",
  faq: "faq",
  cta: "cta",
  contact: "contact",
} as const;

export type LandingSectionHash = (typeof LANDING_SECTIONS)[keyof typeof LANDING_SECTIONS];

export const LANDING_NAV_LINKS = [
  { hash: LANDING_SECTIONS.features, label: "Features" },
  { hash: LANDING_SECTIONS.how, label: "How it works" },
  { hash: LANDING_SECTIONS.mobile, label: "Mobile App" },
  { hash: LANDING_SECTIONS.pricing, label: "Pricing" },
  { hash: LANDING_SECTIONS.faq, label: "FAQ" },
] as const;
