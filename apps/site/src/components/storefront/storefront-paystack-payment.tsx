import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  computeStorefrontCollectionCharge,
  getMomoPaymentCharge,
  initiateOrderPayment,
  patchOrderPayContext,
  submitOrderPaymentOtp,
  verifyStorefrontPayment,
} from "@/lib/storefront-api";

const MOMO_NETWORKS = [
  { id: "mtn", label: "MTN", provider: "mtn" },
  { id: "telecel", label: "Telecel", provider: "vod" },
  { id: "airteltigo", label: "AirtelTigo", provider: "tgo" },
] as const;

function toLocalMomoPhone(raw: string) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length >= 12) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9) digits = `0${digits}`;
  else if (digits.length === 12 && digits.startsWith("233")) digits = `0${digits.slice(3)}`;
  return digits.slice(0, 10);
}

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(2)}`;
}

type Props = {
  token: string;
  orderId: string;
  storeCode: string;
  defaultPhone?: string;
  /** Resume checking a charge started before remount (card return / pending). */
  initialPendingReference?: string | null;
  /** Order face total (before platform fee). */
  faceAmount: number;
  onPaid: () => void;
  onSkip?: () => void;
};

export function StorefrontPaystackPayment({
  token,
  orderId,
  storeCode,
  defaultPhone = "",
  initialPendingReference = null,
  faceAmount,
  onPaid,
  onSkip,
}: Props) {
  const [method, setMethod] = useState<"mobile_money" | "card">("mobile_money");
  const [provider, setProvider] = useState<(typeof MOMO_NETWORKS)[number]["provider"]>("mtn");
  const [momoPhone, setMomoPhone] = useState(() => toLocalMomoPhone(defaultPhone) || "");
  const [busy, setBusy] = useState(false);
  const [needOtp, setNeedOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [txRef, setTxRef] = useState<string | null>(() =>
    initialPendingReference ? String(initialPendingReference).trim() || null : null,
  );
  const [hint, setHint] = useState<string | null>(() =>
    initialPendingReference
      ? "A previous payment may still be processing. Check status, or start a new payment."
      : null,
  );
  const [polling, setPolling] = useState(false);
  const pollStopRef = useRef(false);
  const [charge, setCharge] = useState(() =>
    computeStorefrontCollectionCharge(faceAmount, { enabled: true, percent: 2 }),
  );

  useEffect(() => {
    let cancelled = false;
    getMomoPaymentCharge(token)
      .then((settings) => {
        if (cancelled) return;
        setCharge(computeStorefrontCollectionCharge(faceAmount, settings));
      })
      .catch(() => {
        if (cancelled) return;
        setCharge(computeStorefrontCollectionCharge(faceAmount, { enabled: true, percent: 2 }));
      });
    return () => {
      cancelled = true;
    };
  }, [token, faceAmount]);

  useEffect(() => {
    return () => {
      pollStopRef.current = true;
    };
  }, []);

  const applyChargeFromRes = (res: {
    face_amount?: number;
    fee_amount?: number;
    charge_amount?: number;
    percent?: number;
  }) => {
    if (res.face_amount != null) {
      setCharge({
        face_amount: Number(res.face_amount),
        fee_amount: Number(res.fee_amount || 0),
        charge_amount: Number(res.charge_amount ?? res.face_amount),
        percent: Number(res.percent || charge.percent),
        enabled: Number(res.fee_amount || 0) > 0,
      });
    }
  };

  /** Never mark UI paid from initiate alone — settle via verify first. */
  const settlePaidViaVerify = async (reference: string) => {
    const res = await verifyStorefrontPayment({
      storeCode,
      orderId,
      reference,
      token,
    });
    if (res.paid || String(res.status || "").toLowerCase() === "success") {
      toast.success("Payment successful.");
      onPaid();
      return true;
    }
    return false;
  };

  const pollUntilPaid = async (reference: string) => {
    setPolling(true);
    pollStopRef.current = false;
    // Give the customer time to approve the MoMo prompt before the first verify.
    await new Promise((r) => setTimeout(r, 10000));
    if (pollStopRef.current) {
      setPolling(false);
      return false;
    }
    const maxAttempts = 24;
    for (let i = 0; i < maxAttempts; i += 1) {
      if (pollStopRef.current) break;
      try {
        const res = await verifyStorefrontPayment({
          storeCode,
          orderId,
          reference,
          token,
        });
        if (res.paid || String(res.status || "").toLowerCase() === "success") {
          toast.success("Payment successful.");
          onPaid();
          setPolling(false);
          return true;
        }
        if (["failed", "abandoned"].includes(String(res.status || "").toLowerCase())) {
          setHint("Payment was not completed. You can try again.");
          setPolling(false);
          return false;
        }
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    setHint("Still waiting for confirmation. Tap “Check payment status” after approving on your phone.");
    setPolling(false);
    return false;
  };

  const checkStatus = async () => {
    if (!txRef) {
      toast.error("Start payment first.");
      return;
    }
    setBusy(true);
    try {
      const res = await verifyStorefrontPayment({
        storeCode,
        orderId,
        reference: txRef,
        token,
      });
      if (res.paid || String(res.status || "").toLowerCase() === "success") {
        toast.success("Payment successful.");
        onPaid();
        return;
      }
      toast.message(
        String(res.status || "pending") === "pending"
          ? "Payment still pending — approve on your phone if prompted."
          : `Status: ${res.status}`,
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not verify payment.");
    } finally {
      setBusy(false);
    }
  };

  const startPay = async () => {
    setBusy(true);
    setHint(null);
    try {
      const callback_url =
        typeof window !== "undefined"
          ? `${window.location.origin}/s/${encodeURIComponent(storeCode)}/order/${encodeURIComponent(orderId)}?pay=verify`
          : undefined;

      if (method === "card") {
        const res = await initiateOrderPayment(token, orderId, {
          payment_method: "card",
          phone: momoPhone || defaultPhone || "0000000000",
          callback_url,
        });
        applyChargeFromRes(res);
        if (res.transaction_ref) {
          patchOrderPayContext(orderId, { pending_reference: res.transaction_ref });
          setTxRef(res.transaction_ref);
        }
        if (res.redirect_url) {
          window.location.href = res.redirect_url;
          return;
        }
        throw new Error("Card checkout did not return a Paystack link.");
      }

      const phone = toLocalMomoPhone(momoPhone);
      if (!/^0\d{9}$/.test(phone)) {
        toast.error("Enter a valid 10-digit MoMo number.");
        setBusy(false);
        return;
      }

      const res = await initiateOrderPayment(token, orderId, {
        payment_method: "mobile_money",
        phone,
        provider,
        callback_url,
      });
      applyChargeFromRes(res);
      const reference = res.transaction_ref || null;
      setTxRef(reference);
      if (reference) patchOrderPayContext(orderId, { pending_reference: reference });
      setHint(res.display_text || "Approve the prompt on your phone, or enter the voucher/OTP if asked.");
      const status = String(res.status || "").toLowerCase();
      if ((status === "success" || status === "paid") && reference) {
        // Settle on server via verify — do not trust initiate status alone.
        const settled = await settlePaidViaVerify(reference);
        if (settled) return;
        setNeedOtp(true);
        toast.message("Confirming payment… use Check payment status if it doesn’t update.");
        void pollUntilPaid(reference);
        return;
      }
      setNeedOtp(true);
      toast.message("Complete payment on your phone, then enter OTP if required.");
      if (reference) {
        void pollUntilPaid(reference);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async () => {
    if (!txRef || otp.length < 4) {
      toast.error("Enter the OTP or voucher code.");
      return;
    }
    setBusy(true);
    try {
      const res = await submitOrderPaymentOtp(token, orderId, { reference: txRef, otp });
      const status = String(res.status || "").toLowerCase();
      if (status === "success" || status === "paid") {
        // OTP path already syncs on the server when Paystack returns success.
        const settled = await settlePaidViaVerify(txRef);
        if (settled) return;
        toast.success("Payment successful.");
        onPaid();
        return;
      }
      setHint(res.display_text || "Waiting for confirmation…");
      toast.message(res.display_text || "Check your phone and try again if needed.");
      void pollUntilPaid(txRef);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "OTP failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 space-y-4 rounded-md border border-border/70 bg-background p-4 text-left">
      <div>
        <h2 className="font-display text-lg font-semibold">Pay with Paystack</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Mobile money or card — secure checkout via Paystack.
        </p>
      </div>

      <div className="space-y-1.5 rounded-md bg-muted/50 px-3 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Order total</span>
          <span>{formatGhs(charge.face_amount)}</span>
        </div>
        {charge.enabled && charge.fee_amount > 0 ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Service fee ({charge.percent}%)</span>
            <span>{formatGhs(charge.fee_amount)}</span>
          </div>
        ) : (
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span>Service fee</span>
            <span>None</span>
          </div>
        )}
        <div className="flex justify-between gap-3 border-t border-border/60 pt-2 font-semibold">
          <span>You pay</span>
          <span>{formatGhs(charge.charge_amount)}</span>
        </div>
        {charge.enabled && charge.fee_amount > 0 ? (
          <p className="pt-1 text-xs text-muted-foreground">
            Incl. {charge.percent}% collection fee. The shop receives {formatGhs(charge.face_amount)}.
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={method === "mobile_money" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMethod("mobile_money")}
        >
          Mobile money
        </Button>
        <Button
          type="button"
          variant={method === "card" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMethod("card")}
        >
          Card
        </Button>
      </div>

      {method === "mobile_money" ? (
        <>
          <div className="space-y-2">
            <Label>Network</Label>
            <div className="flex flex-wrap gap-2">
              {MOMO_NETWORKS.map((n) => (
                <Button
                  key={n.id}
                  type="button"
                  size="sm"
                  variant={provider === n.provider ? "default" : "outline"}
                  onClick={() => setProvider(n.provider)}
                >
                  {n.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="momo">MoMo number</Label>
            <Input
              id="momo"
              inputMode="tel"
              value={momoPhone}
              onChange={(e) => setMomoPhone(e.target.value)}
              placeholder="024 XXX XXXX"
              className="h-11"
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          You&apos;ll be redirected to Paystack to complete card payment, then return here.
        </p>
      )}

      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {polling ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Checking payment status…
        </p>
      ) : null}

      {needOtp ? (
        <div className="space-y-3">
          <Label>OTP / voucher</Label>
          <InputOTP maxLength={8} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button className="w-full" size="lg" disabled={busy} onClick={submitOtp}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Confirm payment · {formatGhs(charge.charge_amount)}
          </Button>
        </div>
      ) : (
        <Button className="w-full" size="lg" disabled={busy} onClick={startPay}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {method === "card"
            ? `Continue to Paystack · ${formatGhs(charge.charge_amount)}`
            : `Pay with MoMo · ${formatGhs(charge.charge_amount)}`}
        </Button>
      )}

      {txRef ? (
        <Button type="button" variant="outline" className="w-full" disabled={busy || polling} onClick={checkStatus}>
          Check payment status
        </Button>
      ) : null}

      {onSkip ? (
        <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onSkip}>
          Pay later instead
        </Button>
      ) : null}

      <p className="pt-1 text-center text-[11px] tracking-wide text-muted-foreground">
        Powered by{" "}
        <a
          href="https://paystack.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground/80 underline-offset-2 hover:underline"
        >
          Paystack
        </a>
      </p>
    </section>
  );
}
