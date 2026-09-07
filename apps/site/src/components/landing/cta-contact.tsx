import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRight, Apple, Play } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { subscribeNewsletter, submitContactRequest } from "@/lib/ims-api";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  message: z.string().trim().min(5, "Tell us a bit more").max(1000),
});
const emailSchema = z.string().trim().email("Enter a valid email").max(255);

export function CtaContact() {
  const [news, setNews] = useState("");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [newsLoading, setNewsLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const onNews = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(news);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setNewsLoading(true);
    try {
      const result = await subscribeNewsletter(parsed.data);
      if (result.alreadySubscribed) {
        toast.success("You're already subscribed.");
      } else {
        toast.success("You're subscribed. Welcome aboard!");
      }
      setNews("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not subscribe. Try again.");
    } finally {
      setNewsLoading(false);
    }
  };

  const onContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      await submitContactRequest(parsed.data);
      toast.success("Thanks! We'll get back to you within one business day.");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send message. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="cta" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-brand p-10 sm:p-14 text-primary-foreground shadow-glow"
        >
          <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight">
              Ready to modernize your inventory and ordering?
            </h2>
            <p className="mt-4 opacity-90">Start free in minutes. No credit card. Cancel anytime.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="h-12 bg-foreground text-background hover:opacity-90" asChild>
                <Link to="/start-trial">
                  Start Free Trial <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
                <Apple className="h-4 w-4 mr-2" /><Play className="h-4 w-4 mr-2" /> Download App
              </Button>
            </div>
          </div>
        </motion.div>

        <div id="contact" className="grid lg:grid-cols-2 gap-6 mt-12">
          <div className="rounded-[5px] glass p-8">
            <h3 className="font-display text-2xl font-semibold">Get product updates</h3>
            <p className="mt-2 text-sm text-muted-foreground">Monthly newsletter. New features, tips for retailers, no spam.</p>
            <form onSubmit={onNews} className="mt-6 flex gap-2">
              <Input value={news} onChange={(e) => setNews(e.target.value)} type="email" placeholder="you@store.com" className="h-11" disabled={newsLoading} />
              <Button type="submit" disabled={newsLoading} className="h-11 bg-gradient-brand text-primary-foreground">
                {newsLoading ? "…" : "Subscribe"}
              </Button>
            </form>
          </div>

          <form onSubmit={onContact} className="rounded-[5px] glass p-8">
            <h3 className="font-display text-2xl font-semibold">Talk to us</h3>
            <p className="mt-2 text-sm text-muted-foreground">Tell us about your store — we'll get back within a day.</p>
            <div className="mt-5 grid gap-3">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="h-11" />
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="Email" className="h-11" />
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" rows={4} />
              <Button type="submit" disabled={loading} className="bg-gradient-brand text-primary-foreground h-11">
                {loading ? "Sending…" : "Send message"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
