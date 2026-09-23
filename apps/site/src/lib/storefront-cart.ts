const CART_PREFIX = "shopynn.storefront.cart.";

export type CartLine = {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  thumbnail?: string | null;
  quantity_available?: number;
};

function key(storeCode: string) {
  return `${CART_PREFIX}${String(storeCode || "").toLowerCase()}`;
}

export function readCart(storeCode: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(storeCode));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(storeCode: string, lines: CartLine[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(storeCode), JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent("shopynn-cart", { detail: { storeCode } }));
}

export function clearCart(storeCode: string) {
  writeCart(storeCode, []);
}

export function upsertCartLine(storeCode: string, line: CartLine) {
  const lines = readCart(storeCode);
  const idx = lines.findIndex((l) => l.product_id === line.product_id);
  if (line.quantity <= 0) {
    if (idx >= 0) lines.splice(idx, 1);
  } else if (idx >= 0) {
    lines[idx] = { ...lines[idx], ...line };
  } else {
    lines.push(line);
  }
  writeCart(storeCode, lines);
  return lines;
}

export function cartCount(storeCode: string) {
  return readCart(storeCode).reduce((s, l) => s + Number(l.quantity || 0), 0);
}

export function cartTotal(storeCode: string) {
  return readCart(storeCode).reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);
}
