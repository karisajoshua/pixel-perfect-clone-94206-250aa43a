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
    try {
      const redact = (value: any): any => {
        if (Array.isArray(value)) return value.map(redact);
        if (!value || typeof value !== "object") return value;
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key,
            /token|password/i.test(key) ? "[redacted]" : redact(item),
          ]),
        );
      };
      console.log(
        "[ipen] login response keys",
        res.data && typeof res.data === "object" ? Object.keys(res.data) : typeof res.data,
        redact(res.data),
      );
    } catch {}
    const t = extractTokens(res.data);
    const mfaRequired = Boolean(t.mfaRequired || t.mfaToken);

    const row = {
      user_id: userId as string,
      ipen_email: data.email,
      access_token: mfaRequired ? null : (t.accessToken ?? null),
      refresh_token: mfaRequired ? null : (t.refreshToken ?? null),
      token_expires_at: !mfaRequired && t.expiresIn
        ? new Date(Date.now() + t.expiresIn * 1000).toISOString()
        : null,
      mfa_token: t.mfaToken ?? null,
      mfa_required: mfaRequired,
      last_login_at: mfaRequired ? null : new Date().toISOString(),
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
      .select("mfa_token, ipen_email")
      .eq("user_id", userId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cred) throw new Error("Sign in with your IPEN account first, then enter the OTP.");

    if (!cred.mfa_token) {
      throw new Error("Your IPEN OTP session has expired. Reconnect to request a new OTP.");
    }

    const code = data.code.trim();
    const dto = {
      mfaToken: cred.mfa_token,
      code,
      email: cred.ipen_email ?? undefined,
    };
    const pascalDto = {
      MfaToken: cred.mfa_token,
      Code: code,
      Email: cred.ipen_email ?? undefined,
    };
    const attempts: Array<{ path: string; body: Record<string, unknown>; label: string }> = [
      { path: "/api/Auth/login/verify-mfa", body: dto, label: "camel" },
      { path: "/api/Auth/login/verify-mfa", body: pascalDto, label: "pascal" },
      {
        path: "/api/Auth/login/verify-mfa",
        body: { verifyMfaDto: dto, VerifyMfaDto: pascalDto },
        label: "wrapped",
      },
      { path: "/api/Auth/verify-mfa", body: dto, label: "legacy-camel" },
      { path: "/api/Auth/verify-otp", body: dto, label: "legacy-otp" },
    ];
    let res: Awaited<ReturnType<typeof ipenPublic<any>>> | null = null;
    let lastErr: string | undefined;
    for (const attempt of attempts) {
      res = await ipenPublic<any>({
        path: attempt.path,
        method: "POST",
        body: attempt.body,
        noAuth: true,
      });
      try {
        const redact = (value: any): any => {
          if (Array.isArray(value)) return value.map(redact);
          if (!value || typeof value !== "object") return value;
          return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
              key,
              /token|password/i.test(key) ? "[redacted]" : redact(item),
            ]),
          );
        };
        console.log(
          "[ipen] verify-mfa",
          attempt.path,
          attempt.label,
          res.status,
          res.ok,
          res.error,
          redact(res.data),
        );
      } catch {}
      if (res.ok) break;
      lastErr = res.error ?? `IPEN ${res.status}`;
      const expired = /expired|invalid|challenge|mfa/i.test(lastErr);
      if (expired) {
        await supabase
          .from("ipen_credentials")
          .update({ mfa_token: null, mfa_required: false })
          .eq("user_id", userId);
        throw new Error("The IPEN OTP challenge expired or was replaced. Reconnect to request a new OTP.");
      }
      if (![400, 404, 405, 415, 422, 500, 502].includes(res.status)) break;
    }
    if (!res || !res.ok) {
      const message = lastErr?.includes("502")
        ? "IPEN rejected the OTP verification request. Reconnect to request a fresh OTP and try again."
        : (lastErr ?? "MFA verification failed");
      throw new Error(message);
    }
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
      .select("mfa_token, ipen_email")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cred) throw new Error("Sign in with your IPEN account first.");
    const body: Record<string, unknown> = {};
    if (cred.mfa_token) {
      body.mfaToken = cred.mfa_token;
      body.MfaToken = cred.mfa_token;
    }
    if (cred.ipen_email) {
      body.email = cred.ipen_email;
      body.Email = cred.ipen_email;
    }
    const paths = ["/api/Auth/login/resend-mfa", "/api/Auth/resend-otp", "/api/Auth/resend-mfa"];
    let res: Awaited<ReturnType<typeof ipenPublic<any>>> | null = null;
    let lastErr: string | undefined;
    for (const path of paths) {
      res = await ipenPublic<any>({ path, method: "POST", body, noAuth: true });
      if (res.ok) break;
      lastErr = res.error;
      if (res.status !== 404 && res.status !== 405) break;
    }
    if (!res || !res.ok) throw new Error(lastErr ?? "Failed to resend code");
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
      connected: Boolean(data.access_token) && !data.mfa_required,
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
        idNumber: z.string().min(1),
        identificationTypeId: z.coerce.number().int().positive(),
        registerAs: z.string().min(1).default("Individual"),
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
    // Send both camelCase and PascalCase keys — some IPEN endpoints bind
    // strictly to PascalCase model properties.
    const dual = (k: string, v: unknown, out: Record<string, unknown>) => {
      if (v === undefined || v === null || v === "") return;
      out[k] = v;
      out[k.charAt(0).toUpperCase() + k.slice(1)] = v;
    };
    const dto: Record<string, unknown> = {};
    dual("email", data.email, dto);
    dual("password", data.password, dto);
    dual("confirmPassword", data.confirmPassword, dto);
    dual("firstName", data.firstName, dto);
    dual("lastName", data.lastName, dto);
    dual("phoneNumber", data.phoneNumber, dto);
    dual("middleName", data.middleName, dto);
    dual("idNumber", data.idNumber, dto);
    dual("identificationTypeId", data.identificationTypeId, dto);
    dual("registerAs", data.registerAs, dto);
    dual("companyName", data.companyName, dto);
    // The API wraps the DTO under `registerUserDto` (case-insensitive).
    const body: Record<string, unknown> = {
      registerUserDto: dto,
      RegisterUserDto: dto,
      ...dto,
    };

    const res = await ipenPublic<any>({
      path: "/api/Auth/Register",
      method: "POST",
      body,
      noAuth: true,
    });
    if (!res.ok) throw new Error(res.error ?? "IPEN registration failed");
    try {
      console.log(
        "[ipen] register response keys",
        res.data && typeof res.data === "object" ? Object.keys(res.data) : typeof res.data,
        res.data,
      );
    } catch {}
    const t = extractTokens(res.data);
    const mfaRequired = Boolean(t.mfaRequired || t.mfaToken);

    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      user_id: userId as string,
      ipen_email: data.email,
      access_token: mfaRequired ? null : (t.accessToken ?? null),
      refresh_token: mfaRequired ? null : (t.refreshToken ?? null),
      token_expires_at: !mfaRequired && t.expiresIn
        ? new Date(Date.now() + t.expiresIn * 1000).toISOString()
        : null,
      mfa_token: t.mfaToken ?? null,
      mfa_required: mfaRequired,
      last_login_at: !mfaRequired && t.accessToken ? now : null,
    };
    const { error } = await supabase
      .from("ipen_credentials")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    return {
      registered: true,
      connected: Boolean(t.accessToken) && !mfaRequired,
      mfaRequired,
      message: t.accessToken
        ? mfaRequired
          ? "Enter the verification code sent to you."
          : "IPEN account created and connected."
        : mfaRequired
          ? "Enter the verification code sent to you."
          : "Account created. Check your email to verify, then sign in below.",
    };
  });