import { apiPost } from "./api-client";

export type SubscribeNewsletterResult = {
  subscriber?: { email: string; status: string };
  alreadySubscribed?: boolean;
  reactivated?: boolean;
};

export type ContactRequestResult = {
  request?: { id: string; name: string; email: string };
};

export type TenantOnboardPayload = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  notes?: string;
  subscription_type: number;
  first_name: string;
  last_name: string;
  owner_email: string;
  owner_phone: string;
  password?: string;
  registration_method?: string;
  organization?: string;
  verification_token: string;
};

export type EmailOtpSendResult = {
  email: string;
  expires_in_seconds: number;
};

export type EmailOtpVerifyResult = {
  email: string;
  verification_token: string;
  expires_in_seconds: number;
};

export function sendShopOwnerSignupEmailOtp(email: string) {
  return apiPost<EmailOtpSendResult>("/api/users/shop-owner-signup/send-email-otp", { email });
}

export function verifyShopOwnerSignupEmailOtp(email: string, otp: string) {
  return apiPost<EmailOtpVerifyResult>("/api/users/shop-owner-signup/verify-email-otp", { email, otp });
}

export type TenantOnboardResult = {
  tenant: { id: string; name: string | null };
  subscription: { id: string; name: string | null; status: string | null };
  user: { id: string };
};

export function subscribeNewsletter(email: string, source = "shopynn-landing") {
  return apiPost<SubscribeNewsletterResult>("/api/public/newsletter/subscribe", { email, source });
}

export function submitContactRequest(payload: { name: string; email: string; message: string }) {
  return apiPost<ContactRequestResult>("/api/public/contact", payload);
}

/** Public self-serve signup — same as POST /api/tenants/setup */
export function createTenantTrial(payload: TenantOnboardPayload) {
  return apiPost<TenantOnboardResult>("/api/tenants/setup", {
    ...payload,
    registration_method: payload.registration_method ?? "manual",
  });
}

export const SUBSCRIPTION_PLANS = [
  {
    value: 1,
    slug: "free",
    label: "Free — 14 days",
    description: "Active immediately. Explore Shopynn with Free-tier limits for 14 days. No payment required.",
    activatesImmediately: true,
  },
  {
    value: 2,
    slug: "basic",
    label: "Basic — GHS 229/mo",
    description: "Account is created now. Access starts after you complete payment in the app (subscription stays pending until then).",
    activatesImmediately: false,
  },
  {
    value: 3,
    slug: "standard",
    label: "Standard — GHS 429/mo",
    description: "Account is created now. Complete payment in the app to activate Standard features.",
    activatesImmediately: false,
  },
  {
    value: 4,
    slug: "premium",
    label: "Premium — GHS 799/mo",
    description: "Account is created now. Complete payment in the app to activate Premium features.",
    activatesImmediately: false,
  },
] as const;

export function getSubscriptionPlan(value: number) {
  return SUBSCRIPTION_PLANS.find((p) => p.value === value) ?? SUBSCRIPTION_PLANS[0];
}

export type BillingCatalogGrouped = {
  items: { code: string; item_type: string; plan_tier: string | null; label: string; amount_ghs: number }[];
  plans: Record<string, Record<string, { amount_ghs: number; label: string }>>;
  addons: { code: string; label: string; amount_ghs: number }[];
};

export async function fetchPublicBillingCatalog(): Promise<BillingCatalogGrouped | null> {
  const base = import.meta.env.VITE_IMS_API_URL || "http://localhost:4000/api";
  try {
    const res = await fetch(`${base}/public/billing/catalog`, { headers: { Accept: "application/json" } });
    const json = await res.json();
    return (json?.data ?? json) as BillingCatalogGrouped;
  } catch {
    return null;
  }
}

export function planPriceFromCatalog(catalog: BillingCatalogGrouped | null, tier: string): string {
  const monthly = catalog?.plans?.[tier]?.subscription_monthly;
  if (monthly) return `GHS ${Number(monthly.amount_ghs).toFixed(0)}`;
  const fallback: Record<string, string> = { basic: "GHS 229", standard: "GHS 429", premium: "GHS 799" };
  return fallback[tier] || "—";
}

export type ChatMessage = {
  id: string;
  body: string;
  sender_type: "visitor" | "staff";
  is_staff: boolean;
  created_at: string;
};

export type ChatSession = {
  id: string;
  visitor_token: string;
  name: string;
  email: string;
  status: string;
};

export type ChatSessionPayload = {
  session: ChatSession;
  messages: ChatMessage[];
  visitor_token: string;
};

export function startSiteChat(payload: {
  visitor_token?: string;
  name: string;
  email: string;
  message: string;
}) {
  return apiPost<ChatSessionPayload>("/api/public/chat/session", payload);
}

export async function fetchSiteChat(visitorToken: string): Promise<ChatSessionPayload | null> {
  const { apiGet } = await import("./api-client");
  try {
    return await apiGet<ChatSessionPayload>(`/api/public/chat/session/${visitorToken}`);
  } catch {
    return null;
  }
}

export function sendSiteChatMessage(visitorToken: string, message: string) {
  return apiPost<ChatSessionPayload>(`/api/public/chat/session/${visitorToken}/messages`, { message });
}

export function subscriptionTypeFromSlug(slug: string | undefined): number {
  const normalized = (slug || "free").toLowerCase();
  const found = SUBSCRIPTION_PLANS.find((p) => p.slug === normalized);
  return found?.value ?? 1;
}
