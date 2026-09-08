import { motion } from "framer-motion";
import { Apple, Play, BellRing, MapPin, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import mobile from "@/assets/mobile-mockup.jpg";
import { useEffect, useState } from "react";

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export function MobileApp() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  useEffect(() => setPlatform(detectPlatform()), []);

  const appStore = (
    <Button size="lg" className="h-14 px-5 gap-3 bg-foreground text-background hover:opacity-90" asChild>
      <a href="#" aria-label="Download on the App Store">
        <Apple className="h-6 w-6" />
        <span className="text-left leading-tight">
          <span className="block text-[10px] opacity-70">Download on the</span>
          <span className="block text-sm font-semibold">App Store</span>
        </span>
      </a>
    </Button>
  );
  const playStore = (
    <Button size="lg" variant="outline" className="h-14 px-5 gap-3" asChild>
      <a href="#" aria-label="Get it on Google Play">
        <Play className="h-6 w-6" />
        <span className="text-left leading-tight">
          <span className="block text-[10px] opacity-70">GET IT ON</span>
          <span className="block text-sm font-semibold">Google Play</span>
        </span>
      </a>
    </Button>
  );

  return (
    <section id="mobile" className="relative py-24 overflow-hidden bg-background">
      <div className="relative mx-auto max-w-6xl px-4 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-xs uppercase tracking-widest text-primary">Mobile</div>
          <h2 className="font-display mt-3 text-3xl sm:text-5xl font-semibold tracking-tight">
            Your store, <span className="text-gradient">in every pocket.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg">
            Customers browse, order and pay in seconds. You get notifications for every order — from a clean native app.
          </p>

          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center gap-3"><BellRing className="h-4 w-4 text-primary" /> Real-time push notifications</li>
            <li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-[var(--orange)]" /> Live order & delivery tracking</li>
            <li className="flex items-center gap-3"><QrCode className="h-4 w-4 text-primary" /> Offline-first with auto-sync</li>
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            {platform === "android" ? <>{playStore}{appStore}</> : <>{appStore}{playStore}</>}
          </div>

          <div className="mt-8 inline-flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="h-20 w-20 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <QrCode className="h-12 w-12" />
            </div>
            <div className="text-sm">
              <div className="font-semibold">Scan to download</div>
              <div className="text-muted-foreground text-xs">App Store & Google Play coming soon</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative"
        >
          <img
            src={mobile}
            alt="Shopynn mobile app on iOS and Android"
            width={1280}
            height={1280}
            loading="lazy"
            className="relative rounded-xl border border-border w-full h-auto shadow-card"
          />
        </motion.div>
      </div>
    </section>
  );
}
