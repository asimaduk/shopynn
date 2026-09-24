import { API_BASE_URL } from "./config";
import { apiGet, apiPost, ApiError } from "./api-client";

export type StorefrontStore = {
  tenant_id: string;
  warehouse_id: string;
  reference_code: string;
  store: {
    id: string;
    name: string | null;
    address: string | null;
    minimum_order_amount?: number;
  };
  company: { name: string | null; logo?: string | null };
  share_path?: string;
};

export type StorefrontProduct = {
  id: string;
  name: string;
  slug?: string | null;
  sku?: string;
  unit_price: number;
  thumbnail?: string | null;
  quantity_available?: number;
  installment_enabled?: boolean;
  installment_min_initial_percent?: number;
  installment_min_payment_amount?: number;
};

/** Prefer slug in public product URLs; fall back to id for older products. */
export function storefrontProductPathKey(product: { id?: string; slug?: string | null } | null | undefined) {
  const slug = String(product?.slug || "").trim();
  if (slug) return slug;
  return String(product?.id || "").trim();
}

export function storefrontImageUrl(thumbnail?: string | null) {
  if (!thumbnail) return null;
  if (/^https?:\/\//i.test(thumbnail)) return thumbnail;
  return `${API_BASE_URL}/api/images?id=${encodeURIComponent(thumbnail)}`;
}

export function getPublicStore(code: string) {
  return apiGet<StorefrontStore>(`/api/public/store/${encodeURIComponent(code)}`);
}

export function getPublicStoreCatalog(code: string, search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiGet<{ store: StorefrontStore; products: StorefrontProduct[] }>(
    `/api/public/store/${encodeURIComponent(code)}/catalog${q}`,
  );
}

export function getPublicStoreProduct(code: string, productSlugOrId: string) {
  return apiGet<{
    store: StorefrontStore;
    product: StorefrontProduct & { description?: string | null };
    share_path?: string;
  }>(
    `/api/public/store/${encodeURIComponent(code)}/products/${encodeURIComponent(productSlugOrId)}`,
  );
}

export function sendStorefrontOtp(code: string, phone: string) {
  return apiPost<{
    phone: string;
    expires_in_seconds: number;
    sms_sent?: boolean;
    dev_code?: string;
    dev_hint?: string;
  }>(`/api/public/store/${encodeURIComponent(code)}/otp/send`, { phone });
}

export function verifyStorefrontOtp(code: string, phone: string, otp: string) {
  return apiPost<{
    phone: string;
    session_token: string;
    existing_customer: boolean;
    first_name: string | null;
    last_name: string | null;
  }>(`/api/public/store/${encodeURIComponent(code)}/otp/verify`, { phone, otp });
}

export function createStorefrontOrder(
  code: string,
  body: {
    phone: string;
    session_token: string;
    first_name?: string;
    last_name?: string;
    items: Array<{ product_id: string; quantity: number; unit_price: number }>;
    fulfillment_type?: string;
    notes?: string;
    delivery_address?: string;
    payment_mode?: string;
    initial_payment_amount?: number;
  },
) {
  return apiPost<{
    token: string;
    order: { id: string; order_number: string; total_amount: number; balance_due?: number };
    store: StorefrontStore;
    customer: { id: string; phone: string };
  }>(`/api/public/store/${encodeURIComponent(code)}/orders`, body);
}

export async function initiateOrderPayment(
  token: string,
  orderId: string,
  body: { payment_method: string; phone: string; provider?: string; email?: string; callback_url?: string },
) {
  const url = `${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/payments/initiate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.message || res.statusText || "Payment failed", res.status, json);
  }
  return (json?.data ?? json) as {
    transaction_ref?: string;
    status?: string;
    display_text?: string;
    redirect_url?: string;
    ussd_code?: string;
    face_amount?: number;
    fee_amount?: number;
    charge_amount?: number;
    percent?: number;
  };
}

export async function getMomoPaymentCharge(token: string) {
  const url = `${API_BASE_URL}/api/platform-settings/momo-payment-charge`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.message || res.statusText || "Failed to load fee settings", res.status, json);
  }
  const data = (json?.data ?? json) as {
    enabled?: boolean;
    percent?: number;
    min_percent?: number;
  };
  return {
    enabled: data?.enabled !== false,
    percent: Number(data?.percent) || 2,
    min_percent: Number(data?.min_percent) || 2,
  };
}

export function computeStorefrontCollectionCharge(
  faceAmount: number,
  settings: { enabled: boolean; percent: number },
) {
  const face = Math.round(Number(faceAmount || 0) * 100) / 100;
  if (!settings.enabled || face <= 0) {
    return { face_amount: face, fee_amount: 0, charge_amount: face, percent: settings.percent, enabled: false };
  }
  const fee = Math.round(((face * settings.percent) / 100) * 100) / 100;
  return {
    face_amount: face,
    fee_amount: fee,
    charge_amount: Math.round((face + fee) * 100) / 100,
    percent: settings.percent,
    enabled: true,
  };
}

export async function submitOrderPaymentOtp(
  token: string,
  orderId: string,
  body: { reference: string; otp: string },
) {
  const url = `${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/payments/submit-otp`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.message || res.statusText || "OTP failed", res.status, json);
  }
  return (json?.data ?? json) as {
    transaction_ref?: string;
    status?: string;
    display_text?: string;
  };
}

export async function verifyOrderPayment(token: string, orderId: string, reference: string) {
  const q = `?reference=${encodeURIComponent(reference)}`;
  const url = `${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/payments/verify${q}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.message || res.statusText || "Verification failed", res.status, json);
  }
  return (json?.data ?? json) as {
    transaction_ref?: string;
    status?: string;
    paid?: boolean;
    amount?: number;
    paid_at?: string;
  };
}

/** Card-return / lost JWT: verify by store code + order + Paystack reference. */
export async function verifyStorefrontOrderPaymentPublic(
  storeCode: string,
  orderId: string,
  reference: string,
) {
  return apiPost<{
    transaction_ref?: string;
    status?: string;
    paid?: boolean;
    amount?: number;
    paid_at?: string;
  }>(`/api/public/store/${encodeURIComponent(storeCode)}/orders/${encodeURIComponent(orderId)}/payments/verify`, {
    reference,
  });
}

/** Prefer authenticated verify; fall back to public storefront verify. */
export async function verifyStorefrontPayment(opts: {
  storeCode: string;
  orderId: string;
  reference: string;
  token?: string | null;
}) {
  if (opts.token) {
    try {
      return await verifyOrderPayment(opts.token, opts.orderId, opts.reference);
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 401 && e.status !== 403)) throw e;
    }
  }
  return verifyStorefrontOrderPaymentPublic(opts.storeCode, opts.orderId, opts.reference);
}

const PAY_TOKEN_PREFIX = "shopynn.storefront.pay.";

export function saveOrderPayContext(
  orderId: string,
  ctx: {
    token: string;
    storeCode: string;
    phone?: string;
    total?: string;
    orderNumber?: string;
    pending_reference?: string;
  },
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    `${PAY_TOKEN_PREFIX}${orderId}`,
    JSON.stringify({ ...ctx, saved_at: Date.now() }),
  );
}

export function readOrderPayContext(orderId: string): {
  token: string;
  storeCode: string;
  phone?: string;
  total?: string;
  orderNumber?: string;
  pending_reference?: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${PAY_TOKEN_PREFIX}${orderId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function patchOrderPayContext(
  orderId: string,
  patch: Partial<{ pending_reference: string; phone: string; total: string; orderNumber: string }>,
) {
  const existing = readOrderPayContext(orderId);
  if (!existing) return;
  saveOrderPayContext(orderId, { ...existing, ...patch });
}

export function clearOrderPayContext(orderId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${PAY_TOKEN_PREFIX}${orderId}`);
}

const PAID_PREFIX = "shopynn.storefront.paid.";

/** Mark that Paystack verify succeeded for this order in this browser session. */
export function markOrderPaidLocally(orderId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${PAID_PREFIX}${orderId}`, "1");
}

export function wasOrderPaidLocally(orderId: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`${PAID_PREFIX}${orderId}`) === "1";
}

export { ApiError };
