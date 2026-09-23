const SESSION_PREFIX = "shopynn.storefront.session.";

export type StorefrontSession = {
  phone: string;
  session_token: string;
  first_name?: string | null;
  last_name?: string | null;
  existing_customer?: boolean;
  expires_at?: number;
};

function key(storeCode: string) {
  return `${SESSION_PREFIX}${String(storeCode || "").toLowerCase()}`;
}

export function readSession(storeCode: string): StorefrontSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(storeCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StorefrontSession;
    if (!parsed?.phone || !parsed?.session_token) return null;
    if (parsed.expires_at && Date.now() > parsed.expires_at) {
      sessionStorage.removeItem(key(storeCode));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(storeCode: string, session: StorefrontSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    key(storeCode),
    JSON.stringify({
      ...session,
      expires_at: session.expires_at || Date.now() + 25 * 60 * 1000,
    }),
  );
}

export function clearSession(storeCode: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(key(storeCode));
}
