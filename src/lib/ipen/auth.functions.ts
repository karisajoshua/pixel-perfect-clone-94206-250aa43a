import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipenPublic, extractTokens } from "./ipen-fetch.server";

// Connect the current staff user to IPEN by exchanging their IPEN
// email/password for a token pair, then persist tokens to
// public.ipen_credentials (RLS-scoped to the caller).
export const connectIpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const res = await ipenPublic<any>({
      path: "/api/Auth/Login",
      method: "POST",
      body: { email: data.email, password: data.password },
      noAuth: true,
    });
    if (!res.ok) throw new Error(res.error ?? "IPEN login failed");
    const t = extractTokens(res.data);

    const row = {
      user_id: userId as string,
      ipen_email: data.email,
      access_token: t.accessToken ?? null,
      refresh_token: t.refreshToken ?? null,
      token_expires_at: t.expiresIn
        ? new Date(Date.now() + t.expiresIn * 1000).toISOString()
        : null,
      mfa_token: t.mfaToken ?? null,
      mfa_required: Boolean(t.mfaRequired),
      last_login_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("ipen_credentials")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    return { mfaRequired: row.mfa_required, hasToken: Boolean(row.access_token) };
  });

// Verify a 2FA / OTP code returned by /api/Auth/Login and finalise the login.
export const verifyIpenMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: cred, error: cErr } = await supabase
      .from("ipen_credentials")
      .select("mfa_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cred?.mfa_token) throw new Error("No pending MFA challenge. Log in again.");

    const res = await ipenPublic<any>({
      path: "/api/Auth/login/verify-mfa",
      method: "POST",
      body: { mfaToken: cred.mfa_token, code: data.code },
      noAuth: true,
    });
    if (!res.ok) throw new Error(res.error ?? "MFA verification failed");
    const t = extractTokens(res.data);
    if (!t.accessToken) throw new Error("MFA response missing access token");

    const { error } = await supabase
      .from("ipen_credentials")
      .update({
        access_token: t.accessToken,
        refresh_token: t.refreshToken ?? null,
        token_expires_at: t.expiresIn
          ? new Date(Date.now() + t.expiresIn * 1000).toISOString()
          : null,
        mfa_token: null,
        mfa_required: false,
        last_login_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendIpenMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: cred } = await supabase
      .from("ipen_credentials")
      .select("mfa_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cred?.mfa_token) throw new Error("No pending MFA challenge.");
    const res = await ipenPublic<any>({
      path: "/api/Auth/login/resend-mfa",
      method: "POST",
      body: { mfaToken: cred.mfa_token },
      noAuth: true,
    });
    if (!res.ok) throw new Error(res.error ?? "Failed to resend code");
    return { ok: true };
  });

export const disconnectIpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    // Best-effort remote logout using the current token, ignore failures.
    const { data: cred } = await supabase
      .from("ipen_credentials")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (cred?.access_token) {
      try {
        await ipenPublic<any>({
          path: "/api/Auth/logout",
          method: "POST",
          body: {},
          noAuth: true,
        });
      } catch {}
    }
    const { error } = await supabase.from("ipen_credentials").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ipenStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("ipen_credentials")
      .select("ipen_email, mfa_required, last_login_at, token_expires_at, access_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return { connected: false };
    return {
      connected: Boolean(data.access_token),
      mfa_required: data.mfa_required,
      ipen_email: data.ipen_email,
      last_login_at: data.last_login_at,
      token_expires_at: data.token_expires_at,
    };
  });

// Register a new IPEN account via /api/Auth/Register. If the response
// returns tokens we persist them; if it returns an MFA challenge we store
// the mfaToken so the existing MFA UI can complete verification.
export const registerIpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        confirmPassword: z.string().min(6),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phoneNumber: z.string().min(1),
        middleName: z.string().optional(),
        idNumber: z.string().optional(),
        companyName: z.string().optional(),
      })
      .refine((v) => v.password === v.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const body: Record<string, unknown> = {
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
    };
    if (data.middleName) body.middleName = data.middleName;
    if (data.idNumber) body.idNumber = data.idNumber;
    if (data.companyName) body.companyName = data.companyName;

    const res = await ipenPublic<any>({
      path: "/api/Auth/Register",
      method: "POST",
      body,
      noAuth: true,
    });
    if (!res.ok) throw new Error(res.error ?? "IPEN registration failed");
    const t = extractTokens(res.data);

    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      user_id: userId as string,
      ipen_email: data.email,
      access_token: t.accessToken ?? null,
      refresh_token: t.refreshToken ?? null,
      token_expires_at: t.expiresIn
        ? new Date(Date.now() + t.expiresIn * 1000).toISOString()
        : null,
      mfa_token: t.mfaToken ?? null,
      mfa_required: Boolean(t.mfaRequired),
      last_login_at: t.accessToken ? now : null,
    };
    const { error } = await supabase
      .from("ipen_credentials")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    return {
      registered: true,
      connected: Boolean(t.accessToken),
      mfaRequired: Boolean(t.mfaRequired),
      message: t.accessToken
        ? "IPEN account created and connected."
        : t.mfaRequired
          ? "Enter the verification code sent to you."
          : "Account created. Check your email to verify, then sign in below.",
    };
  });