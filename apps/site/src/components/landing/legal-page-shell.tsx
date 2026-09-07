import { Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/landing/theme-provider";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

type Props = {
  children: React.ReactNode;
};

export function LegalPageShell({ children }: Props) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="pt-28 pb-16">{children}</main>
        <Footer />
        <Toaster position="top-center" />
      </div>
    </ThemeProvider>
  );
}

type LegalDocProps = {
  title: string;
  updated: string;
  intro?: string;
  sections: { heading: string; body: string }[];
};

export function LegalDocument({ title, updated, intro, sections }: LegalDocProps) {
  return (
    <article className="mx-auto max-w-3xl px-4">
      <p className="text-sm text-muted-foreground">
        <Link to="/" className="text-primary hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span>{title}</span>
      </p>
      <h1 className="font-display mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      {intro ? <p className="mt-6 text-muted-foreground leading-relaxed">{intro}</p> : null}
      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-display text-xl font-semibold text-foreground">{s.heading}</h2>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {s.body}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-12 text-xs text-muted-foreground border-t border-border pt-6">
        Questions? Contact us at{" "}
        <a href="mailto:hello@shopynn.app" className="text-primary hover:underline">
          hello@shopynn.app
        </a>
        .
      </p>
    </article>
  );
}
