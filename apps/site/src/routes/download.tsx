import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/components/landing/legal-page-shell";
import { APP_STORE_LIVE, APP_STORE_URL, PLAY_STORE_LIVE, PLAY_STORE_URL } from "@/lib/config";

export const Route = createFileRoute("/download")({
  component: DownloadRoute,
  head: () => ({
    meta: [
      { title: "Download Shopynn" },
      { name: "description", content: "Get the Shopynn app for Android and iPhone." },
    ],
    links: [{ rel: "canonical", href: "/download" }],
  }),
});

function storeUrlForDevice(): string | null {
  const ua = navigator.userAgent || "";
  if (/Android/.test(ua) && PLAY_STORE_LIVE) return PLAY_STORE_URL;
  if (/iPad|iPhone|iPod/.test(ua) && APP_STORE_LIVE) return APP_STORE_URL;
  return null;
}

function DownloadRoute() {
  useEffect(() => {
    window.location.replace(storeUrlForDevice() ?? "/#mobile");
  }, []);

  return (
    <LegalPageShell>
      <div className="mx-auto max-w-md px-4 text-center">
        <h1 className="font-display text-2xl font-semibold">Opening the app store…</h1>
        <p className="mt-3 text-sm text-muted-foreground">If nothing happens, choose your store:</p>
        <div className="mt-6 flex justify-center gap-3 text-sm font-medium">
          {PLAY_STORE_LIVE && <a className="text-primary underline" href={PLAY_STORE_URL}>Google Play</a>}
          {APP_STORE_LIVE && <a className="text-primary underline" href={APP_STORE_URL}>App Store</a>}
          <a className="text-primary underline" href="/#mobile">Mobile app page</a>
        </div>
      </div>
    </LegalPageShell>
  );
}
