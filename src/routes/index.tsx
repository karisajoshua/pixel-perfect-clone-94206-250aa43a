import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Shield, Users, FileText, BellRing, BarChart3, ScrollText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zest Insurance Agency — In-House Management System" },
      { name: "description", content: "Centralised client, policy, claims, and billing platform for Zest Insurance Agency." },
      { property: "og:title", content: "Zest Insurance Agency" },
      { property: "og:description", content: "Centralised client, policy, claims, and billing platform." },
    ],
  }),
  component: Index,
});

function Index() {
  const features = [
    { icon: Users, title: "Clients & Vehicles", body: "Single source of truth for every policyholder, KYC document and vehicle." },
    { icon: FileText, title: "Policies & Quotes", body: "Full lifecycle tracking — quote, bind, renew, archive." },
    { icon: BellRing, title: "Automated Renewals", body: "Email, SMS and WhatsApp reminders that never miss a date." },
    { icon: ScrollText, title: "Claims Management", body: "Structured intake with abstracts, sketches and statement uploads." },
    { icon: BarChart3, title: "Live Analytics", body: "Branch, staff and insurer performance at a glance." },
    { icon: Shield, title: "Secure & Audited", body: "Role-based access, encrypted storage and a full audit trail." },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">Z</div>
            <span className="text-lg font-semibold tracking-tight">Zest Insurance</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth">Get started</Link></Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">In-House Management System</span>
            <h1 className="mt-4 text-5xl font-bold tracking-tight">Run the entire agency from one platform.</h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Clients, vehicles, policies, claims, billing and renewals — orchestrated end to end with role-based access across every branch.
            </p>
            <div className="mt-8 flex gap-3">
              <Button asChild size="lg"><Link to="/auth">Open the workspace</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/auth">Client portal</Link></Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-background p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Zest Insurance Agency
      </footer>
    </div>
  );
}
