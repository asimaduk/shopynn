import { useState } from "react";
import { z } from "zod";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { SIGN_IN_URL } from "@/lib/config";
import {
  SUBSCRIPTION_PLANS,
  createTenantTrial,
  getSubscriptionPlan,
  sendShopOwnerSignupEmailOtp,
  verifyShopOwnerSignupEmailOtp,
} from "@/lib/ims-api";

const trialSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(200),
  phone: z.string().trim().min(6, "Company phone is required").max(40),
  email: z.string().trim().email("Enter a valid company email").max(255),
  address: z.string().trim().min(3, "Address is required").max(500),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
  subscription_type: z.number().int().min(1).max(4),
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  owner_email: z.string().trim().email("Enter a valid owner email").max(255),
  owner_phone: z.string().trim().min(6, "Owner phone is required").max(40),
  password: z.string().max(128).optional(),
});

type Props = {
  initialSubscriptionType: number;
  planSlug?: string;
};

export function StartTrialPage({ initialSubscriptionType, planSlug }: Props) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    subscription_type: String(initialSubscriptionType),
    first_name: "",
    last_name: "",
    owner_email: "",
    owner_phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [ownerEmailVerified, setOwnerEmailVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [success, setSuccess] = useState<{
    ownerEmail: string;
    businessName: string;
    subscriptionType: number;
  } | null>(null);

  const selectedPlan = getSubscriptionPlan(Number(form.subscription_type));

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const resetEmailVerification = () => {
    setOtpSent(false);
    setOwnerEmailVerified(false);
    setVerificationToken("");
    setEmailOtp("");
  };

  const onOwnerEmailChange = (value: string) => {
    set("owner_email", value);
    resetEmailVerification();
  };

  const sendEmailOtp = async () => {
    const email = form.owner_email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid login email first.");
      return;
    }
    setSendingOtp(true);
    try {
      await sendShopOwnerSignupEmailOtp(email);
      setOwnerEmailVerified(false);
      setVerificationToken("");
      setEmailOtp("");
      setOtpSent(true);
      toast.success("Verification code sent. Check your inbox.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send code.");
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyEmailOtp = async () => {
    const email = form.owner_email.trim().toLowerCase();
    const otp = emailOtp.trim();
    if (!/^\d{6}$/.test(otp)) {
      toast.error("Enter the 6-digit code from your email.");
      return;
    }
    setVerifyingOtp(true);
    try {
      const result = await verifyShopOwnerSignupEmailOtp(email, otp);
      setOwnerEmailVerified(true);
      setVerificationToken(result.verification_token);
      toast.success("Email verified. You can create your account.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Verification failed.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = trialSchema.safeParse({
      ...form,
      subscription_type: Number(form.subscription_type),
      password: form.password.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      country: form.country.trim() || undefined,
      postal_code: form.postal_code.trim() || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    if (!ownerEmailVerified || !verificationToken) {
      toast.error("Verify your owner login email with the code we sent before continuing.");
      return;
    }

    setLoading(true);
    try {
      const data = parsed.data;
      await createTenantTrial({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postal_code: data.postal_code,
        subscription_type: data.subscription_type,
        first_name: data.first_name,
        last_name: data.last_name,
        owner_email: data.owner_email.toLowerCase(),
        owner_phone: data.owner_phone,
        verification_token: verificationToken,
        password: data.password,
        notes: `Signup from shopynn landing${planSlug ? ` (plan: ${planSlug})` : ""}`,
        registration_method: "manual",
      });
      setSuccess({
        ownerEmail: data.owner_email,
        businessName: data.name,
        subscriptionType: data.subscription_type,
      });
      toast.success("Your account is ready!");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create account. Try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const successPlan = getSubscriptionPlan(success.subscriptionType);
    return (
      <div className="mx-auto max-w-lg px-4 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground shadow-glow mb-6">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">You&apos;re all set!</h1>
        <p className="mt-3 text-muted-foreground">
          <strong>{success.businessName}</strong> is registered on Shopynn with the{" "}
          <strong className="text-foreground">{successPlan.label}</strong> plan.
        </p>
        {successPlan.activatesImmediately ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Your subscription is <strong className="text-foreground">active</strong> for 14 days. Sign in and start
            using your dashboard right away.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Your subscription is <strong className="text-foreground">pending payment</strong>. Sign in, then open
            Subscription in the app to pay and activate your plan.
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in with <strong className="text-foreground">{success.ownerEmail}</strong>.
          {form.password.trim()
            ? " Use the password you chose during signup."
            : " Check your inbox for a temporary password (expires in 30 minutes)."}
        </p>
        <Button asChild size="lg" className="mt-8 bg-gradient-brand text-primary-foreground h-12">
          <a href={SIGN_IN_URL}>
            Go to sign in <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </Button>
        <p className="mt-6 text-sm">
          <Link to="/" className="text-primary hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="text-center mb-10">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Create your <span className="text-gradient">Shopynn account</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Set up your business, owner login, and chosen plan. We create a Main warehouse/store and Super Admin role for you
          automatically.
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
          <strong className="text-foreground">Free (14 days)</strong> is active immediately with no payment.{" "}
          <strong className="text-foreground">Basic, Standard, and Premium</strong> are reserved at signup and activate
          after you pay in the app.
        </p>
      </div>

      <form onSubmit={onSubmit} className="rounded-[5px] glass p-6 sm:p-8 space-y-8">
        <section>
          <h2 className="font-display text-lg font-semibold mb-4">Plan</h2>
          <div className="grid gap-2">
            <Label htmlFor="subscription_type">Subscription</Label>
            <Select value={form.subscription_type} onValueChange={(v) => set("subscription_type", v)}>
              <SelectTrigger id="subscription_type" className="h-11">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_PLANS.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{selectedPlan.description}</p>
            {!selectedPlan.activatesImmediately ? (
              <p className="text-xs rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
                Want to try the product first? Choose <strong className="text-foreground">Free — 14 days</strong> to sign
                in immediately, then upgrade from Subscription when you are ready.
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-4">Business</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Business name</Label>
              <Input id="name" className="mt-1.5 h-11" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="phone">Company phone</Label>
              <Input id="phone" className="mt-1.5 h-11" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Company email</Label>
              <Input id="email" type="email" className="mt-1.5 h-11" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" className="mt-1.5 h-11" value={form.address} onChange={(e) => set("address", e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" className="mt-1.5 h-11" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="state">State / region</Label>
              <Input id="state" className="mt-1.5 h-11" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
            {/* <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" className="mt-1.5 h-11" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="postal_code">Postal code</Label>
              <Input id="postal_code" className="mt-1.5 h-11" value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
            </div> */}
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-4">Account owner</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" className="mt-1.5 h-11" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" className="mt-1.5 h-11" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="owner_email">Login email</Label>
              <Input
                id="owner_email"
                type="email"
                className="mt-1.5 h-11"
                value={form.owner_email}
                onChange={(e) => onOwnerEmailChange(e.target.value)}
                required
              />
              <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  We send a 6-digit code to confirm you own this email before creating your account.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={sendEmailOtp}
                  disabled={sendingOtp || !form.owner_email.trim() || ownerEmailVerified}
                >
                  {sendingOtp ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    otpSent ? "Resend code" : "Send verification code"
                  )}
                </Button>
                {ownerEmailVerified ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Email verified
                  </p>
                ) : otpSent ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="email_otp"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      className="h-11 sm:max-w-[200px]"
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-11 bg-gradient-brand text-primary-foreground"
                      onClick={verifyEmailOtp}
                      disabled={verifyingOtp || emailOtp.length !== 6}
                    >
                      {verifyingOtp ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        "Verify email"
                      )}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              <Label htmlFor="owner_phone">Mobile phone</Label>
              <Input id="owner_phone" className="mt-1.5 h-11" value={form.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                className="mt-1.5 h-11"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Leave blank to receive a temporary password by email"
              />
            </div>
          </div>
        </section>

        <Button
          type="submit"
          disabled={loading || !ownerEmailVerified}
          size="lg"
          className="w-full h-12 bg-gradient-brand text-primary-foreground"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…
            </>
          ) : (
            <>
              Create account <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <a href={SIGN_IN_URL} className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}
