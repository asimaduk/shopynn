import { Apple, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/config";

/** Bottom CTA — App Store / Play links (env or /#mobile until listings go live). */
export function GetTheAppNote({ className = "" }: { className?: string }) {
  return (
    <aside
      className={`mt-10 border-t border-border/70 pt-8 pb-2 text-left ${className}`}
      aria-labelledby="get-the-app-heading"
    >
      <h2
        id="get-the-app-heading"
        className="font-display text-lg font-semibold tracking-tight text-foreground"
      >
        Get the Shopynn app
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Order faster next time. Sign in with the{" "}
        <span className="font-medium text-foreground">same phone number</span> you use here —
        your store and orders stay linked. This web page works without installing anything.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          size="lg"
          className="h-12 gap-2.5 px-4 bg-foreground text-background hover:opacity-90"
          asChild
        >
          <a href={APP_STORE_URL} aria-label="Download on the App Store">
            <Apple className="size-5" />
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-normal opacity-70">Download on the</span>
              <span className="block text-sm font-semibold">App Store</span>
            </span>
          </a>
        </Button>
        <Button size="lg" variant="outline" className="h-12 gap-2.5 px-4" asChild>
          <a href={PLAY_STORE_URL} aria-label="Get it on Google Play">
            <Play className="size-5" />
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-normal opacity-70">GET IT ON</span>
              <span className="block text-sm font-semibold">Google Play</span>
            </span>
          </a>
        </Button>
      </div>
    </aside>
  );
}
