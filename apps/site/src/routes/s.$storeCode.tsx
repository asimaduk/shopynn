import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/landing/theme-provider";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { getPublicStore, type StorefrontStore } from "@/lib/storefront-api";

export const Route = createFileRoute("/s/$storeCode")({
  component: StorefrontLayout,
});

function StorefrontLayout() {
  const { storeCode: raw } = Route.useParams();
  const storeCode = String(raw || "").toLowerCase();
  const [store, setStore] = useState<StorefrontStore | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicStore(storeCode)
      .then((data) => {
        if (!cancelled) setStore(data);
      })
      .catch(() => {
        if (!cancelled) setStore(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storeCode]);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div
          className="pointer-events-none fixed inset-0 -z-10 opacity-80"
          style={{ background: "var(--gradient-radial)" }}
          aria-hidden
        />
        <StorefrontHeader
          storeCode={storeCode}
          storeName={store?.store?.name}
          companyName={store?.company?.name}
        />
        <main>
          <Outlet />
        </main>
        <Toaster position="top-center" />
      </div>
    </ThemeProvider>
  );
}
