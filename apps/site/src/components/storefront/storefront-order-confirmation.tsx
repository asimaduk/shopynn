import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GetTheAppNote } from "@/components/storefront/get-the-app-note";
import { StorefrontPaystackPayment } from "@/components/storefront/storefront-paystack-payment";
import { Button } from "@/components/ui/button";
import {
  clearOrderPayContext,
  markOrderPaidLocally,
  readOrderPayContext,
  verifyStorefrontPayment,
  wasOrderPaidLocally,
} from "@/lib/storefront-api";

export function StorefrontOrderConfirmation({
  storeCode,
  orderId,
  orderNumber,
  total,
  payStatus,
  fulfillment,
  reference,
}: {
  storeCode: string;
  orderId: string;
  orderNumber?: string;
  total?: string;
  payStatus?: string;
  fulfillment?: string;
  /** Paystack reference / trxref from callback query. */
  reference?: string;
}) {
  const amount = total != null && total !== "" ? Number(total) : null;
  const fulfillLabel =
    fulfillment === "delivery" ? "delivery" : fulfillment === "pickup" ? "pickup" : "fulfillment";
  const [payCtx, setPayCtx] = useState(() => readOrderPayContext(orderId));
  const [paid, setPaid] = useState(() => wasOrderPaidLocally(orderId));
  const [verifying, setVerifying] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(() => {
    const fromUrl = String(reference || "").trim();
    if (fromUrl) return fromUrl;
    const ctx = readOrderPayContext(orderId);
    return String(ctx?.pending_reference || "").trim() || null;
  });
  const [manualCheckBusy, setManualCheckBusy] = useState(false);

  useEffect(() => {
    setPayCtx(readOrderPayContext(orderId));
    if (wasOrderPaidLocally(orderId)) {
      setPaid(true);
      clearOrderPayContext(orderId);
    }
  }, [orderId, payStatus]);

  useEffect(() => {
    const fromUrl = String(reference || "").trim();
    if (fromUrl) setPendingRef(fromUrl);
  }, [reference]);

  useEffect(() => {
    const needsVerify = payStatus === "verify" || payStatus === "done";
    if (!needsVerify || paid) return;
    const ctx = readOrderPayContext(orderId);
    const ref = String(reference || ctx?.pending_reference || "").trim();
    if (!ref) {
      if (needsVerify) {
        toast.error("Missing payment reference. If you paid, contact the store with your order number.");
      }
      return;
    }
    setPendingRef(ref);
    let cancelled = false;
    setVerifying(true);
    verifyStorefrontPayment({
      storeCode,
      orderId,
      reference: ref,
      token: ctx?.token,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.paid || String(res.status || "").toLowerCase() === "success") {
          markOrderPaidLocally(orderId);
          clearOrderPayContext(orderId);
          setPaid(true);
          setPayCtx(null);
          toast.success("Payment confirmed.");
        } else {
          toast.message(
            String(res.status || "pending") === "pending"
              ? "Payment still pending. Use Check payment status below, or pay again."
              : `Payment status: ${res.status}`,
          );
        }
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Could not verify payment.");
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, payStatus, reference, paid, storeCode]);

  const checkPending = async () => {
    const ref = String(pendingRef || payCtx?.pending_reference || reference || "").trim();
    if (!ref) {
      toast.error("No payment reference to check.");
      return;
    }
    setManualCheckBusy(true);
    try {
      const res = await verifyStorefrontPayment({
        storeCode,
        orderId,
        reference: ref,
        token: payCtx?.token,
      });
      if (res.paid || String(res.status || "").toLowerCase() === "success") {
        markOrderPaidLocally(orderId);
        clearOrderPayContext(orderId);
        setPaid(true);
        setPayCtx(null);
        toast.success("Payment confirmed.");
        return;
      }
      toast.message(
        String(res.status || "pending") === "pending"
          ? "Payment still pending."
          : `Status: ${res.status}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not verify payment.");
    } finally {
      setManualCheckBusy(false);
    }
  };

  const showPay = !paid && payCtx?.token && payStatus !== "later";
  const showStandaloneCheck =
    !paid && !verifying && Boolean(pendingRef || reference) && payStatus !== "later";

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        {verifying ? <Loader2 className="size-8 animate-spin" /> : <CheckCircle2 className="size-8" />}
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {verifying ? "Confirming payment…" : paid ? "Paid — thank you" : "Order placed"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {orderNumber ? (
          <>
            Order <span className="font-medium text-foreground">{orderNumber}</span> was sent to the
            store.
          </>
        ) : (
          "Your order was sent to the store."
        )}
      </p>
      {amount != null && Number.isFinite(amount) ? (
        <p className="mt-3 text-lg font-semibold">GHS {amount.toFixed(2)}</p>
      ) : null}
      <p className="mt-4 text-sm text-muted-foreground">
        {verifying
          ? "Checking Paystack for your payment…"
          : paid
            ? "Payment received via Paystack. The shop will prepare your order."
            : payStatus === "later"
              ? `Pay on ${fulfillLabel} — no payment was taken now. The shop will confirm your order.`
              : "Complete payment below, or choose pay later."}
      </p>

      {showPay && !verifying ? (
        <StorefrontPaystackPayment
          token={payCtx.token}
          orderId={orderId}
          storeCode={storeCode}
          defaultPhone={payCtx.phone}
          initialPendingReference={pendingRef || payCtx.pending_reference}
          faceAmount={amount != null && Number.isFinite(amount) ? amount : Number(payCtx.total) || 0}
          onPaid={() => {
            markOrderPaidLocally(orderId);
            clearOrderPayContext(orderId);
            setPaid(true);
            setPayCtx(null);
          }}
          onSkip={() => {
            clearOrderPayContext(orderId);
            setPayCtx(null);
          }}
        />
      ) : null}

      {!showPay && showStandaloneCheck ? (
        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={manualCheckBusy}
            onClick={checkPending}
          >
            {manualCheckBusy ? <Loader2 className="animate-spin" /> : null}
            Check payment status
          </Button>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        <Button asChild size="lg">
          <Link to="/s/$storeCode" params={{ storeCode }}>
            Browse store
          </Link>
        </Button>
        <GetTheAppNote />
      </div>
    </div>
  );
}
