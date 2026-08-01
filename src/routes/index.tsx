import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { normalizePhone, looksLikeEmail } from "@/lib/phone";
import bg1 from "@/assets/auth-bg-1.jpg";
import bg2 from "@/assets/auth-bg-2.jpg";
import bg3 from "@/assets/auth-bg-3.jpg";
import logoWhite from "@/assets/zia-logo-white.png.asset.json";
import logoRed from "@/assets/zia-logo-red.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Zest Insurance Agency" },
      { name: "description", content: "Sign in to the Zest Insurance Agency workspace — clients, policies, claims, billing and renewals in one platform." },
    ],
  }),
  component: AuthPage,
});

const SLIDES = [
  { src: bg1, alt: "Nairobi cityscape at dusk" },
  { src: bg2, alt: "Family receiving keys to a new car" },
  { src: bg3, alt: "Motorbike rider on a coastal highway at sunset" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  // Returns a verified TOTP factor id when this session still needs to step up.
  const pendingMfaFactor = async (): Promise<string | null> => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aal || aal.nextLevel !== "aal2" || aal.currentLevel === "aal2") return null;
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
    return totp?.id ?? null;
  };

  const routeAfterAuth = async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const [{ data: roles }, { data: member }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("tenant_members").select("tenant_id").eq("user_id", uid).maybeSingle(),
    ]);
    const list = (roles ?? []).map((r) => r.role);
    const clientOnly = list.length > 0 && list.every((r) => r === "client");
    const isSuper = list.includes("super_admin");
    if (clientOnly) return navigate({ to: "/portal" });
    if (!member && !isSuper) {
      const { data: clientRow } = await supabase
        .from("clients").select("id").eq("auth_user_id", uid).maybeSingle();
      if (clientRow) return navigate({ to: "/portal" });
      return navigate({ to: "/onboarding" });
    }
    navigate({ to: "/dashboard" });
  };

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    setLoading(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (chErr || !ch) { setLoading(false); return toast.error(chErr?.message ?? "Could not start verification"); }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: ch.id,
      code: mfaCode.trim(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setMfaFactorId(null);
    setMfaCode("");
    toast.success("Verified");
    await routeAfterAuth();
  };

  const cancelMfa = async () => {
    setMfaFactorId(null);
    setMfaCode("");
    setPassword("");
    await supabase.auth.signOut();
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const factorId = await pendingMfaFactor();
      if (factorId) { setMfaFactorId(factorId); return; }
      const uid = data.session.user.id;
      const [{ data: roles }, { data: member }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("tenant_members").select("tenant_id").eq("user_id", uid).maybeSingle(),
      ]);
      const list = (roles ?? []).map((r) => r.role);
      const clientOnly = list.length > 0 && list.every((r) => r === "client");
      const isSuper = list.includes("super_admin");
      if (clientOnly) return navigate({ to: "/portal" });
      if (!member && !isSuper) {
        const { data: clientRow } = await supabase
          .from("clients").select("id").eq("auth_user_id", uid).maybeSingle();
        if (clientRow) return navigate({ to: "/portal" });
        return navigate({ to: "/onboarding" });
      }
      navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const value = identifier.trim();
    let credentials: any;
    if (looksLikeEmail(value)) {
      credentials = { email: value, password };
    } else {
      const phone = normalizePhone(value);
      if (!phone) { setLoading(false); return toast.error("Enter a valid email or phone number"); }
      credentials = { phone, password };
    }
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) { setLoading(false); return toast.error(error.message); }
    const factorId = await pendingMfaFactor();
    setLoading(false);
    if (factorId) {
      setMfaFactorId(factorId);
      setMfaCode("");
      return;
    }
    toast.success("Welcome back");
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const [{ data: roles }, { data: member }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("tenant_members").select("tenant_id").eq("user_id", uid).maybeSingle(),
    ]);
    const list = (roles ?? []).map((r) => r.role);
    const clientOnly = list.length > 0 && list.every((r) => r === "client");
    const isSuper = list.includes("super_admin");
    if (clientOnly) return navigate({ to: "/portal" });
    if (!member && !isSuper) {
      const { data: clientRow } = await supabase
        .from("clients").select("id").eq("auth_user_id", uid).maybeSingle();
      if (clientRow) return navigate({ to: "/portal" });
      return navigate({ to: "/onboarding" });
    }
    navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Check your email if confirmation is required.");
    setTab("signin");
    setPassword("");
  };

  const reset = async () => {
    const value = identifier.trim();
    if (!value || !looksLikeEmail(value)) return toast.error("Enter your email above to reset your password");
    const { error } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-sidebar-foreground overflow-hidden">
        {SLIDES.map((s, i) => (
          <img
            key={i}
            src={s.src}
            alt={s.alt}
            width={1024}
            height={1536}
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
              slide === i ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/35 to-black/70" />
        <Link to="/" className="relative flex items-center">
          <img src={logoWhite.url} alt="Zest Insurance Agency" className="h-20 w-auto object-contain" />
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-bold">Built for the way agencies actually run.</h2>
          <p className="mt-4 text-sidebar-foreground/80 max-w-md">
            Multi-branch, role-based, and ready for clients, policies, claims and renewals from day one.
          </p>
          <div className="mt-6 flex gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all ${slide === i ? "w-8 bg-primary" : "w-4 bg-sidebar-foreground/40"}`}
              />
            ))}
          </div>
        </div>
        <p className="relative text-xs text-sidebar-foreground/60">
          © {new Date().getFullYear()} Zest Insurance Agency · Powered by Texcortech Systems
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col items-center">
          <img
            src={logoRed.url}
            alt="Zest Insurance Agency"
            className="h-16 w-auto object-contain mb-6 lg:hidden"
          />
          <Card className="w-full">
          <CardHeader>
            <CardTitle>Welcome to Zest</CardTitle>
            <CardDescription>Sign in to the management workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="identifier">Email or phone</Label>
                    <Input id="identifier" type="text" autoComplete="username" placeholder="you@example.com or 0712 345 678" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>Sign in</Button>
                  <button type="button" className="text-xs text-muted-foreground underline" onClick={reset}>Forgot password?</button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password2">Password</Label>
                    <div className="relative">
                      <Input id="password2" type={showPassword ? "text" : "password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>Create account</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          </Card>
        </div>
        <p className="absolute bottom-4 text-xs text-muted-foreground lg:hidden">
          Powered by Texcortech Systems
        </p>
      </div>
    </div>
  );
}