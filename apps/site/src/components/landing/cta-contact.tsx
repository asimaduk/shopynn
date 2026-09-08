import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { subscribeNewsletter, submitContactRequest } from "@/lib/ims-api";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  message: z.string().trim().min(10, "Please share a bit more detail (at least 10 characters)").max(2000),
});
const emailSchema = z.string().trim().email("Enter a valid email").max(255);

export function CtaContact() {
  const [news, setNews] = useState("");
  const [newsFieldError, setNewsFieldError] = useState<string | null>(null);
  const [newsDone, setNewsDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "email" | "message", string>>>({});
  const [contactDone, setContactDone] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  // Honeypot — bots fill this; humans leave it empty
  const [companyWebsite, setCompanyWebsite] = useState("");

  const onNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsDone(false);
    setNewsFieldError(null);
    const parsed = emailSchema.safeParse(news);
    if (!parsed.success) {
      const msg = parsed.error.issues[0].message;
      setNewsFieldError(msg);
      return toast.error(msg);
    }
    setNewsLoading(true);
    try {
      const result = await subscribeNewsletter(parsed.data, "shopynn-landing-updates");
      if (result.alreadySubscribed) {
        toast.success("You're already on the list.");
      } else if (result.reactivated) {
        toast.success("Welcome back — you're subscribed again.");
      } else {
        toast.success("You're subscribed. We'll keep you posted.");
      }
      setNews("");
      setNewsDone(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not subscribe. Check your connection and try again.");
    } finally {
      setNewsLoading(false);
    }
  };

  const onContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactDone(false);
    if (companyWebsite.trim()) {
      // Silent success for bots
      setContactDone(true);
      setForm({ name: "", email: "", message: "" });
      return;
    }
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const next: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "name" || key === "email" || key === "message") {
          next[key] = issue.message;
        }
      }
      setFieldErrors(next);
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      await submitContactRequest(parsed.data);
      toast.success("Thanks! We'll get back to you within one business day.");
      setForm({ name: "", email: "", message: "" });
      setContactDone(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send message. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="cta" className="relative py-24 bg-background">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-10 sm:p-14 shadow-card"
        >
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary via-primary/70 to-[var(--orange)]" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-foreground">
              Ready to modernize your inventory and ordering?
            </h2>
            <p className="mt-4 text-muted-foreground">Start free in minutes. No credit card. Cancel anytime.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="h-12 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link to="/start-trial">
                  Start Free Trial <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12" asChild>
                <a href="#contact">Talk to us</a>
              </Button>
            </div>
          </div>
        </motion.div>

        <div id="contact" className="grid lg:grid-cols-2 gap-6 mt-12">
          <div className="rounded-xl border border-border bg-card p-8 shadow-card">
            <h3 className="font-display text-2xl font-semibold">Get product updates</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Occasional notes on new features and tips for running your store. Unsubscribe anytime.
            </p>
            {newsDone ? (
              <div className="mt-6 flex items-start gap-3 rounded-lg bg-accent/80 px-4 py-3 text-sm text-accent-foreground">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--orange)]" />
                <p>You're on the list. Watch your inbox for the next update.</p>
              </div>
            ) : null}
            <form onSubmit={onNews} className="mt-6 space-y-3" noValidate>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={news}
                  onChange={(e) => {
                    setNews(e.target.value);
                    setNewsFieldError(null);
                    setNewsDone(false);
                  }}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@store.com"
                  className="h-11"
                  disabled={newsLoading}
                  aria-invalid={Boolean(newsFieldError)}
                />
                <Button type="submit" disabled={newsLoading} className="h-11 bg-primary text-primary-foreground hover:bg-primary/90 sm:min-w-28">
                  {newsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
                </Button>
              </div>
              {newsFieldError ? <p className="text-xs text-destructive">{newsFieldError}</p> : null}
            </form>
          </div>

          <form onSubmit={onContact} className="rounded-xl border border-border bg-card p-8 shadow-card" noValidate>
            <h3 className="font-display text-2xl font-semibold">Talk to us</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tell us about your store — sales, stock challenges, or a demo. We reply within one business day.
            </p>
            {contactDone ? (
              <div className="mt-5 flex items-start gap-3 rounded-lg bg-accent/80 px-4 py-3 text-sm text-accent-foreground">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--orange)]" />
                <p>Message received. We'll follow up by email soon.</p>
              </div>
            ) : null}
            <div className="mt-5 grid gap-3">
              <div>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    setContactDone(false);
                  }}
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  className="h-11"
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name ? <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p> : null}
              </div>
              <div>
                <Input
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    setContactDone(false);
                  }}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Email"
                  className="h-11"
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email ? <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p> : null}
              </div>
              <div>
                <Textarea
                  value={form.message}
                  onChange={(e) => {
                    setForm({ ...form, message: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, message: undefined }));
                    setContactDone(false);
                  }}
                  name="message"
                  placeholder="How can we help? (e.g. demo for a supermarket in Accra)"
                  rows={4}
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.message)}
                />
                {fieldErrors.message ? <p className="mt-1 text-xs text-destructive">{fieldErrors.message}</p> : null}
              </div>
              {/* Honeypot */}
              <input
                type="text"
                name="company_website"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden
              />
              <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 h-11">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send message"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
