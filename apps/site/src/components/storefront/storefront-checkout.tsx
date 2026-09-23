import { useNavigate } from "@tanstack/react-router";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GetTheAppNote } from "@/components/storefront/get-the-app-note";
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
import { StorefrontPaystackPayment } from "@/components/storefront/storefront-paystack-payment";

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(2)}`;
}

type Step = "cart" | "phone" | "otp" | "details" | "pay";

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
      <div className="mx-auto max-w-lg px-4 pb-16 pt-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Pay for your order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order <span className="font-medium text-foreground">{placed.orderNumber}</span> ·{" "}
          {formatGhs(placed.total)}
        </p>
        <StorefrontPaystackPayment
          token={placed.token}
          orderId={placed.orderId}
          storeCode={storeCode}
          defaultPhone={phone}
          faceAmount={placed.total}
          onPaid={() => finishAfterPay(true)}
          onSkip={() => finishAfterPay(false)}
        />
        <GetTheAppNote className="mt-6" />
      </div>
    );
  }

  if (lines.length === 0 && step === "cart") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">Add products from the catalog to order.</p>
        <Button
          className="mt-6"
          onClick={() => navigate({ to: "/s/$storeCode", params: { storeCode } })}
        >
          Browse products
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-4">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {store?.store?.name || store?.company?.name || storeCode}
      </p>

      {step === "cart" || step === "details" ? (
        <section className="mt-6 space-y-3">
          {lines.map((line) => (
            <div
              key={line.product_id}
              className="flex items-start justify-between gap-3 border-b border-border/60 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{line.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatGhs(line.unit_price)} × {line.quantity}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-border p-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => updateQty(line, Math.max(0, line.quantity - 1))}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="min-w-5 text-center text-sm">{line.quantity}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => updateQty(line, line.quantity + 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive"
                    onClick={() => updateQty(line, 0)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-sm font-medium">{formatGhs(line.quantity * line.unit_price)}</p>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatGhs(total)}</span>
          </div>
          {belowMin ? (
            <p className="text-sm text-destructive">
              Minimum order for this store is {formatGhs(minOrder)}.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "cart" ? (
        <Button
          className="mt-8 w-full"
          size="lg"
          disabled={belowMin || lines.length === 0}
          onClick={() => setStep(sessionToken ? "details" : "phone")}
        >
          Continue
        </Button>
      ) : null}

      {step === "phone" ? (
        <section className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="024 XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">We&apos;ll send a one-time code by SMS.</p>
          </div>
          <Button className="w-full" size="lg" disabled={busy} onClick={sendOtp}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Send code
          </Button>
          {!express ? (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("cart")}>
              Back to cart
            </Button>
          ) : null}
        </section>
      ) : null}

      {step === "otp" ? (
        <section className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium text-foreground">{phone}</span>
          </p>
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {devCode ? (
            <p className="text-xs text-muted-foreground">Dev code: {devCode}</p>
          ) : null}
          <Button className="w-full" size="lg" disabled={busy} onClick={verifyOtp}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Verify
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={sendOtp}>
            Resend code
          </Button>
        </section>
      ) : null}

      {step === "details" ? (
        <section className="mt-8 space-y-4">
          {nameKnown && !editingName ? (
            <div className="rounded-md border border-border/70 bg-muted/40 px-4 py-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input
                  id="first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11"
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input
                  id="last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11"
                  autoComplete="family-name"
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Fulfillment</Label>
            <div className="flex gap-2">
              {(["pickup", "delivery"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={fulfillment === t ? "default" : "outline"}
                  className="flex-1 capitalize"
                  onClick={() => setFulfillment(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
          {fulfillment === "delivery" ? (
            <div className="space-y-2">
              <Label htmlFor="addr">Delivery address</Label>
              <Input
                id="addr"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="h-11"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Payment</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={payMode === "now" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPayMode("now")}
              >
                Pay now
              </Button>
              <Button
                type="button"
                variant={payMode === "later" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPayMode("later")}
              >
                Pay on {fulfillment === "delivery" ? "delivery" : "pickup"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {payMode === "now"
                ? "Pay with mobile money or card via Paystack after placing the order."
                : "No payment now — settle when you receive the order."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
          </div>
          <p className="text-xs text-muted-foreground">
            {nameKnown && !editingName ? null : <>Verified as {phone}.</>}
          </p>
          <Button className="w-full" size="lg" disabled={busy || belowMin} onClick={placeOrder}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {payMode === "now" ? `Place order & pay · ${formatGhs(total)}` : `Place order · ${formatGhs(total)}`}
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
  );
}
