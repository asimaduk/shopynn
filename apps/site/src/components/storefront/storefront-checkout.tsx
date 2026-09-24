import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GetTheAppNote } from "@/components/storefront/get-the-app-note";
import { StorefrontPaystackPayment } from "@/components/storefront/storefront-paystack-payment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  ApiError,
  createStorefrontOrder,
  getPublicStore,
  getPublicStoreCatalog,
  saveOrderPayContext,
  clearOrderPayContext,
  markOrderPaidLocally,
  sendStorefrontOtp,
  storefrontImageUrl,
  verifyStorefrontOtp,
  type StorefrontStore,
} from "@/lib/storefront-api";
import {
  clearCart,
  readCart,
  type CartLine,
  upsertCartLine,
  writeCart,
} from "@/lib/storefront-cart";
import { clearSession, readSession, writeSession } from "@/lib/storefront-session";
import { cn } from "@/lib/utils";

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(2)}`;
}

type Step = "cart" | "phone" | "otp" | "details" | "pay";

const CHECKOUT_STEPS = [
  { id: "cart", label: "Cart" },
  { id: "account", label: "Account" },
  { id: "details", label: "Details" },
  { id: "pay", label: "Pay" },
] as const;

function stepIndex(step: Step): number {
  if (step === "cart") return 0;
  if (step === "phone" || step === "otp") return 1;
  if (step === "details") return 2;
  return 3;
}

function CheckoutStepper({ step }: { step: Step }) {
  const active = stepIndex(step);
  return (
    <ol className="flex items-center gap-1 sm:gap-2">
      {CHECKOUT_STEPS.map((s, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition sm:size-8",
                  done && "bg-primary text-primary-foreground",
                  current && "bg-foreground text-background ring-4 ring-foreground/10",
                  !done && !current && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden truncate text-xs font-medium sm:inline md:text-sm",
                  current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < CHECKOUT_STEPS.length - 1 ? (
              <div
                className={cn(
                  "mx-1 h-px min-w-3 flex-1 sm:mx-2",
                  i < active ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function CartLineRow({
  line,
  onUpdate,
  compact = false,
}: {
  line: CartLine;
  onUpdate: (line: CartLine, quantity: number) => void;
  compact?: boolean;
}) {
  const img = storefrontImageUrl(line.thumbnail);
  return (
    <div
      className={cn(
        "flex gap-3",
        compact ? "py-3" : "rounded-xl border border-border/70 bg-card p-3 sm:p-4",
      )}
    >
      <div
        className={cn(
          "shrink-0 overflow-hidden rounded-lg bg-muted",
          compact ? "size-14" : "size-16 sm:size-20",
        )}
      >
        {img ? (
          <img src={img} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
            No img
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("font-medium leading-snug text-foreground", compact ? "text-sm line-clamp-2" : "line-clamp-2")}>
            {line.name}
          </p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {formatGhs(line.quantity * line.unit_price)}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatGhs(line.unit_price)} each
        </p>
        <div className="mt-2.5 inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 rounded-full"
            onClick={() => onUpdate(line, Math.max(0, line.quantity - 1))}
            aria-label="Decrease"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="min-w-6 text-center text-sm font-medium tabular-nums">{line.quantity}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 rounded-full"
            onClick={() => onUpdate(line, line.quantity + 1)}
            aria-label="Increase"
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 rounded-full text-destructive hover:text-destructive"
            onClick={() => onUpdate(line, 0)}
            aria-label="Remove"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderSummaryCard({
  storeTitle,
  lines,
  total,
  minOrder,
  belowMin,
  onUpdate,
  sticky = false,
  editable = true,
}: {
  storeTitle: string;
  lines: CartLine[];
  total: number;
  minOrder: number;
  belowMin: boolean;
  onUpdate: (line: CartLine, quantity: number) => void;
  sticky?: boolean;
  editable?: boolean;
}) {
  return (
    <aside
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-5 shadow-sm lg:p-6",
        sticky && "lg:sticky lg:top-24",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Order summary</p>
          <p className="mt-1 font-display text-lg font-semibold tracking-tight">{storeTitle}</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {lines.length} {lines.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="mt-5 divide-y divide-border/70">
        {lines.map((line) =>
          editable ? (
            <CartLineRow key={line.product_id} line={line} onUpdate={onUpdate} compact />
          ) : (
            <div key={line.product_id} className="flex gap-3 py-3">
              <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {storefrontImageUrl(line.thumbnail) ? (
                  <img
                    src={storefrontImageUrl(line.thumbnail)!}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium">{line.name}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatGhs(line.quantity * line.unit_price)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Qty {line.quantity} · {formatGhs(line.unit_price)}
                </p>
              </div>
            </div>
          ),
        )}
      </div>

      <div className="mt-5 space-y-2 border-t border-border/70 pt-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatGhs(total)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatGhs(total)}</span>
        </div>
        {belowMin ? (
          <p className="text-sm text-destructive">
            Minimum order for this store is {formatGhs(minOrder)}.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

export function StorefrontCheckout({
  storeCode,
  express = false,
  payLater = false,
}: {
  storeCode: string;
  express?: boolean;
  /** Default to pay-later when true (legacy query). Prefer in-form toggle. */
  payLater?: boolean;
}) {
  const navigate = useNavigate();
  const [store, setStore] = useState<StorefrontStore | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [step, setStep] = useState<Step>("cart");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameKnown, setNameKnown] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [payMode, setPayMode] = useState<"now" | "later">(payLater ? "later" : "now");
  const [busy, setBusy] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [placed, setPlaced] = useState<{
    orderId: string;
    orderNumber: string;
    total: number;
    token: string;
  } | null>(null);

  useEffect(() => {
    setPayMode(payLater ? "later" : "now");
  }, [payLater]);

  const refreshCart = () => setLines(readCart(storeCode));

  useEffect(() => {
    let cancelled = false;
    setStoreLoading(true);
    setStoreError(null);
    refreshCart();
    getPublicStore(storeCode)
      .then((data) => {
        if (cancelled) return;
        setStore(data);
        setStoreError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setStore(null);
        setStoreError(e instanceof ApiError ? e.message : "Store not found.");
      })
      .finally(() => {
        if (!cancelled) setStoreLoading(false);
      });

    getPublicStoreCatalog(storeCode)
      .then((catalog) => {
        if (cancelled) return;
        const byId = new Map((catalog.products || []).map((p) => [String(p.id), p]));
        const cart = readCart(storeCode);
        if (!cart.length) return;
        let removed = 0;
        let adjusted = 0;
        const next: CartLine[] = [];
        for (const line of cart) {
          const live = byId.get(String(line.product_id));
          if (!live) {
            removed += 1;
            continue;
          }
          const available = Number(live.quantity_available ?? 0);
          if (available <= 0) {
            removed += 1;
            continue;
          }
          const qty = Math.min(Number(line.quantity) || 1, available);
          if (qty !== Number(line.quantity)) adjusted += 1;
          const price = Number(live.unit_price || 0);
          if (price !== Number(line.unit_price)) adjusted += 1;
          next.push({
            product_id: String(live.id),
            name: live.name,
            unit_price: price,
            quantity: qty,
            thumbnail: live.thumbnail,
            quantity_available: available,
          });
        }
        writeCart(storeCode, next);
        refreshCart();
        if (removed > 0 || adjusted > 0) {
          toast.message(
            removed > 0
              ? "Cart updated — some items were out of stock or unavailable."
              : "Cart updated with current prices and stock.",
          );
        }
      })
      .catch(() => {
        /* store error handled separately */
      });

    const existing = readSession(storeCode);
    if (existing) {
      setPhone(existing.phone);
      setSessionToken(existing.session_token);
      if (existing.first_name) setFirstName(existing.first_name);
      if (existing.last_name) setLastName(existing.last_name);
      const known =
        Boolean(existing.existing_customer) ||
        Boolean(String(existing.first_name || "").trim() && String(existing.last_name || "").trim());
      setNameKnown(known && Boolean(existing.first_name?.trim() && existing.last_name?.trim()));
    }
    const onCart = () => refreshCart();
    window.addEventListener("shopynn-cart", onCart);
    return () => {
      cancelled = true;
      window.removeEventListener("shopynn-cart", onCart);
    };
  }, [storeCode]);

  useEffect(() => {
    if (booted) return;
    const cart = readCart(storeCode);
    if (cart.length === 0) {
      setBooted(true);
      return;
    }
    if (express) {
      const existing = readSession(storeCode);
      setStep(existing?.session_token ? "details" : "phone");
    }
    setBooted(true);
  }, [storeCode, express, booted]);

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const minOrder = Number(store?.store?.minimum_order_amount || 0);
  const belowMin = minOrder > 0 && total < minOrder;
  const storeTitle = store?.store?.name || store?.company?.name || storeCode;

  const updateQty = (line: CartLine, quantity: number) => {
    const max = Number(line.quantity_available);
    const nextQty =
      Number.isFinite(max) && max > 0 ? Math.min(Math.max(0, quantity), max) : Math.max(0, quantity);
    if (Number.isFinite(max) && max > 0 && quantity > max) {
      toast.error(`Only ${max} in stock for ${line.name}.`);
    }
    upsertCartLine(storeCode, { ...line, quantity: nextQty });
    refreshCart();
  };

  const sendOtp = async () => {
    if (!phone.trim()) {
      toast.error("Enter your mobile number.");
      return;
    }
    setBusy(true);
    try {
      const res = await sendStorefrontOtp(storeCode, phone.trim());
      setPhone(res.phone);
      setDevCode(res.dev_code || null);
      setStep("otp");
      if (res.sms_sent) {
        toast.success("Code sent by SMS.");
      } else if (res.dev_code) {
        toast.message(`Dev code: ${res.dev_code}`);
      } else {
        toast.error("SMS could not be sent. Please try again.");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not send code.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const res = await verifyStorefrontOtp(storeCode, phone, otp);
      writeSession(storeCode, {
        phone: res.phone,
        session_token: res.session_token,
        first_name: res.first_name,
        last_name: res.last_name,
        existing_customer: res.existing_customer,
      });
      setSessionToken(res.session_token);
      setPhone(res.phone);
      const fn = String(res.first_name || "").trim();
      const ln = String(res.last_name || "").trim();
      if (fn) setFirstName(fn);
      if (ln) setLastName(ln);
      const known = Boolean(res.existing_customer && fn && ln);
      setNameKnown(known);
      setEditingName(false);
      setStep("details");
      toast.success(known ? `Welcome back, ${fn}.` : "Phone verified.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async () => {
    if (!sessionToken) {
      setStep("phone");
      toast.error("Verify your phone to continue.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Enter your first and last name.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }
    if (belowMin) {
      toast.error(`Minimum order is ${formatGhs(minOrder)}.`);
      return;
    }
    if (fulfillment === "delivery" && !deliveryAddress.trim()) {
      toast.error("Enter a delivery address.");
      return;
    }
    setBusy(true);
    try {
      const wantPayNow = payMode === "now";
      const payNote = wantPayNow
        ? "Pay now (Paystack)"
        : fulfillment === "delivery"
          ? "Pay on delivery"
          : "Pay on pickup";
      const combinedNotes = [payNote, notes.trim()].filter(Boolean).join(" · ") || undefined;

      const result = await createStorefrontOrder(storeCode, {
        phone,
        session_token: sessionToken,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        fulfillment_type: fulfillment,
        delivery_address: fulfillment === "delivery" ? deliveryAddress.trim() : undefined,
        notes: combinedNotes,
        payment_mode: "full",
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      });
      clearCart(storeCode);
      const orderId = String(result.order.id);
      const orderNumber = result.order.order_number;
      const orderTotal = Number(result.order.total_amount || 0);

      if (wantPayNow && result.token) {
        saveOrderPayContext(orderId, {
          token: result.token,
          storeCode,
          phone,
          total: String(orderTotal),
          orderNumber,
        });
        setPlaced({ orderId, orderNumber, total: orderTotal, token: result.token });
        setStep("pay");
        toast.success("Order placed — complete payment.");
        return;
      }

      clearSession(storeCode);
      toast.success("Order placed.");
      void navigate({
        to: "/s/$storeCode/order/$orderId",
        params: { storeCode, orderId },
        search: {
          number: orderNumber,
          total: String(orderTotal),
          pay: "later",
          fulfill: fulfillment,
        },
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not place order.");
    } finally {
      setBusy(false);
    }
  };

  const finishAfterPay = (paid: boolean) => {
    if (!placed) return;
    clearSession(storeCode);
    if (paid) markOrderPaidLocally(placed.orderId);
    clearOrderPayContext(placed.orderId);
    void navigate({
      to: "/s/$storeCode/order/$orderId",
      params: { storeCode, orderId: placed.orderId },
      search: {
        number: placed.orderNumber,
        total: String(placed.total),
        pay: paid ? "paid" : "later",
        fulfill: fulfillment,
      },
    });
  };

  if (storeLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading store…
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Store not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {storeError || "This store link is invalid or no longer active."}
        </p>
      </div>
    );
  }

  if (step === "pay" && placed) {
    return (
      <div className="mx-auto max-w-7xl px-3 pb-16 pt-4 sm:px-5 lg:px-8 lg:pt-8">
        <div className="mb-6 max-w-2xl">
          <CheckoutStepper step="pay" />
        </div>
        <div className="mx-auto max-w-xl">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Payment</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Pay for your order
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Order <span className="font-medium text-foreground">{placed.orderNumber}</span> ·{" "}
              {formatGhs(placed.total)}
            </p>
            <div className="mt-6">
              <StorefrontPaystackPayment
                token={placed.token}
                orderId={placed.orderId}
                storeCode={storeCode}
                defaultPhone={phone}
                faceAmount={placed.total}
                onPaid={() => finishAfterPay(true)}
                onSkip={() => finishAfterPay(false)}
              />
            </div>
          </div>
          <GetTheAppNote className="mt-8" />
        </div>
      </div>
    );
  }

  if (lines.length === 0 && step === "cart") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="size-7 text-muted-foreground" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse the catalog and add items to place an order.
        </p>
        <Button
          className="mt-7 rounded-full px-6"
          size="lg"
          onClick={() => navigate({ to: "/s/$storeCode", params: { storeCode } })}
        >
          Continue shopping
        </Button>
      </div>
    );
  }

  const showSummary = step === "cart" || step === "details" || step === "phone" || step === "otp";

  return (
    <div className="mx-auto max-w-7xl px-3 pb-16 pt-4 sm:px-5 lg:px-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 lg:mb-8">
        <div>
          <Link
            to="/s/$storeCode"
            params={{ storeCode }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to store
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Checkout
          </h1>
        </div>
      </div>

      <div className="mb-8 max-w-2xl">
        <CheckoutStepper step={step} />
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7 xl:col-span-7">
          {step === "cart" ? (
            <section className="space-y-4">
              <div className="lg:hidden">
                <OrderSummaryCard
                  storeTitle={storeTitle}
                  lines={lines}
                  total={total}
                  minOrder={minOrder}
                  belowMin={belowMin}
                  onUpdate={updateQty}
                />
              </div>
              <div className="hidden space-y-3 lg:block">
                {lines.map((line) => (
                  <CartLineRow key={line.product_id} line={line} onUpdate={updateQty} />
                ))}
                {belowMin ? (
                  <p className="text-sm text-destructive">
                    Minimum order for this store is {formatGhs(minOrder)}.
                  </p>
                ) : null}
              </div>
              <Button
                className="mt-4 h-12 w-full rounded-full text-base font-semibold lg:mt-6"
                size="lg"
                disabled={belowMin || lines.length === 0}
                onClick={() => setStep(sessionToken ? "details" : "phone")}
              >
                Continue to checkout
              </Button>
            </section>
          ) : null}

          {step === "phone" ? (
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Account</p>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">
                Verify your phone
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We&apos;ll send a one-time code by SMS so we can find or create your customer profile.
              </p>
              <div className="mt-6 space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="024 XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              <Button
                className="mt-6 h-12 w-full rounded-full text-base font-semibold"
                size="lg"
                disabled={busy}
                onClick={sendOtp}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                Send code
              </Button>
              {!express ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 w-full"
                  onClick={() => setStep("cart")}
                >
                  Back to cart
                </Button>
              ) : null}
            </section>
          ) : null}

          {step === "otp" ? (
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Account</p>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">Enter code</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sent to <span className="font-medium text-foreground">{phone}</span>
              </p>
              <div className="mt-6 flex justify-center sm:justify-start">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {devCode ? (
                <p className="mt-3 text-xs text-muted-foreground">Dev code: {devCode}</p>
              ) : null}
              <Button
                className="mt-6 h-12 w-full rounded-full text-base font-semibold"
                size="lg"
                disabled={busy}
                onClick={verifyOtp}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                Verify & continue
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full"
                disabled={busy}
                onClick={sendOtp}
              >
                Resend code
              </Button>
            </section>
          ) : null}

          {step === "details" ? (
            <section className="space-y-5">
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Delivery details
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">
                  How should we fulfill this?
                </h2>

                {nameKnown && !editingName ? (
                  <div className="mt-5 rounded-xl border border-border/70 bg-muted/40 px-4 py-3.5">
                    <p className="text-sm font-medium text-foreground">
                      Welcome back, {firstName}
                      {lastName ? ` ${lastName}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Ordering as {phone}. We already have your name on file.
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => setEditingName(true)}
                    >
                      Change name
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first">First name</Label>
                      <Input
                        id="first"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-11 rounded-xl"
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last">Last name</Label>
                      <Input
                        id="last"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-11 rounded-xl"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 space-y-2">
                  <Label>Fulfillment</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "pickup" as const, label: "Pickup", icon: Package },
                        { id: "delivery" as const, label: "Delivery", icon: Truck },
                      ] as const
                    ).map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFulfillment(id)}
                        className={cn(
                          "flex flex-col items-start gap-2 rounded-xl border px-4 py-3.5 text-left transition",
                          fulfillment === id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border/80 bg-background hover:border-border",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5",
                            fulfillment === id ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="text-sm font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {fulfillment === "delivery" ? (
                  <div className="mt-5 space-y-2">
                    <Label htmlFor="addr">Delivery address</Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="addr"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="h-11 rounded-xl pl-9"
                        placeholder="Street, landmark, area"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 space-y-2">
                  <Label>Payment</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPayMode("now")}
                      className={cn(
                        "rounded-xl border px-4 py-3.5 text-left transition",
                        payMode === "now"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/80 bg-background hover:border-border",
                      )}
                    >
                      <p className="text-sm font-semibold">Pay now</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        MoMo or card via Paystack
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMode("later")}
                      className={cn(
                        "rounded-xl border px-4 py-3.5 text-left transition",
                        payMode === "later"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/80 bg-background hover:border-border",
                      )}
                    >
                      <p className="text-sm font-semibold">
                        Pay on {fulfillment === "delivery" ? "delivery" : "pickup"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Settle when you receive the order
                      </p>
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="Any special instructions"
                  />
                </div>

                {!(nameKnown && !editingName) ? (
                  <p className="mt-4 text-xs text-muted-foreground">Verified as {phone}.</p>
                ) : null}
              </div>

              <Button
                className="h-12 w-full rounded-full text-base font-semibold"
                size="lg"
                disabled={busy || belowMin}
                onClick={placeOrder}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                {payMode === "now"
                  ? `Place order & pay · ${formatGhs(total)}`
                  : `Place order · ${formatGhs(total)}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  writeCart(storeCode, lines);
                  setStep(express ? "phone" : "cart");
                }}
              >
                Back
              </Button>
              <GetTheAppNote className="mt-2" />
            </section>
          ) : null}
        </div>

        {showSummary ? (
          <div className="hidden lg:col-span-5 lg:block xl:col-span-5">
            <OrderSummaryCard
              storeTitle={storeTitle}
              lines={lines}
              total={total}
              minOrder={minOrder}
              belowMin={belowMin}
              onUpdate={updateQty}
              sticky
              editable={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
