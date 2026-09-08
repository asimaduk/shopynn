import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SIGN_IN_URL } from "@/lib/config";
import { LANDING_NAV_LINKS, LANDING_SECTIONS } from "@/lib/landing-nav";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all",
        scrolled ? "py-2" : "py-4",
      )}
    >
      <div className="mx-auto max-w-6xl px-4">
        <nav
          className={cn(
            "flex items-center justify-between rounded-[5px] px-4 py-2.5 transition-all",
            scrolled ? "glass shadow-card" : "bg-transparent",
          )}
        >
          <Link to="/" hash={LANDING_SECTIONS.top} className="flex items-center gap-2">
            <img
              src="/logo/shopynn-icon.png"
              alt="Shopynn"
              className="h-8 w-8 object-contain"
              width={32}
              height={32}
            />
            <span className="font-display text-lg font-semibold">Shopynn</span>
          </Link>

          <ul className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            {LANDING_NAV_LINKS.map((l) => (
              <li key={l.hash}>
                <Link to="/" hash={l.hash} className="hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <a href={SIGN_IN_URL}>Login</a>
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link to="/start-trial">Get Started</Link>
            </Button>
            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden h-9 w-9 grid place-items-center rounded-lg hover:bg-muted"
              aria-label="Menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>

        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden mt-2 glass rounded-[5px] p-4 flex flex-col gap-3"
          >
            {LANDING_NAV_LINKS.map((l) => (
              <Link
                key={l.hash}
                to="/"
                hash={l.hash}
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}
