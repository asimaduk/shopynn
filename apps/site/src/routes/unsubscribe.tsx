import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { LegalPageShell } from "@/components/landing/legal-page-shell";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { subscribeNewsletter, unsubscribeNewsletter } from "@/lib/ims-api";

type UnsubscribeSearch = { e?: string; t?: string };

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>): UnsubscribeSearch => ({
    e: typeof search.e === "string" ? search.e : undefined,
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  component: UnsubscribeRoute,
  head: () => ({
    meta: [{ title: "Unsubscribe · Shopynn" }, { name: "robots", content: "noindex" }],
  }),
});

type State = "idle" | "loading" | "done" | "resubscribed" | "error";

function UnsubscribeRoute() {
  const { e: email, t: token } = Route.useSearch();
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, next: State) => {
    setState("loading");
    setError(null);
    try {
      await action();
      setState(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  };

  const linkBroken = !email || !token;

  return (
    <LegalPageShell>
      <div className="mx-auto max-w-md px-4 text-center">
        {linkBroken ? (
          <>
            <h1 className="font-display text-2xl font-semibold">This link is incomplete</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Use the unsubscribe link at the bottom of any Shopynn email, or write to{" "}
              <a className="text-primary underline" href="mailto:hello@shopynn.app">
                hello@shopynn.app
              </a>
              .
            </p>
          </>
        ) : state === "done" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 font-display text-2xl font-semibold">You're unsubscribed</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{email}</span> won't receive Shopynn
              updates anymore. Account emails like receipts and security codes still arrive.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() =>
                run(() => subscribeNewsletter(email, "unsubscribe-undo"), "resubscribed")
              }
            >
              Unsubscribed by mistake? Subscribe again
            </Button>
          </>
        ) : state === "resubscribed" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Welcome back</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              You're subscribed to Shopynn updates again.
            </p>
            <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary underline">
              Go to shopynn.app
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold">
              Unsubscribe from Shopynn updates?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We'll stop sending newsletters to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </p>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            <Button
              className="mt-6"
              disabled={state === "loading"}
              onClick={() => run(() => unsubscribeNewsletter(email, token), "done")}
            >
              {state === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Unsubscribe
            </Button>
          </>
        )}
      </div>
    </LegalPageShell>
  );
}
