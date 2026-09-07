/**
 * Contact-channel abstraction (browser-safe).
 *
 * The engine resolves *which channels a customer can be reached on* before an
 * action node runs, so a phone-only client never produces a failed email step.
 * Only `email` is executable today; `whatsapp` and `sms` are represented so
 * Phase 2 can add them without redesigning the workflow engine.
 */
export type Channel = "email" | "whatsapp" | "sms";

export const EXECUTABLE_CHANNELS: Channel[] = ["email"];
export const PLANNED_CHANNELS: Channel[] = ["whatsapp", "sms"];

export interface ContactResolution {
  has_email: boolean;
  has_phone: boolean;
  email: string | null;
  phone: string | null;
  /** Channels the customer can, in principle, be reached on. */
  available: Channel[];
  /** Channels we can actually execute right now (subset of available). */
  executable: Channel[];
  /** Channels the customer is reachable on but the engine cannot execute yet. */
  pending: Channel[];
  /** The channel a send should use, or null when nothing is executable. */
  preferred: Channel | null;
  /** Coarse label: "email" | "phone" | "both" | "none". */
  contactable_via: "email" | "phone" | "both" | "none";
  reason: string | null;
}

function clean(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

export function resolveCustomerContact(
  customer: { email?: unknown; phone?: unknown } | null | undefined,
  preferredChannels: Channel[] = ["email", "whatsapp", "sms"],
): ContactResolution {
  const email = clean(customer?.email);
  const phone = clean(customer?.phone);
  const valid_email = email && email.includes("@") ? email : null;

  const available: Channel[] = [];
  if (valid_email) available.push("email");
  if (phone) available.push("whatsapp", "sms");

  const ordered = preferredChannels.filter((c) => available.includes(c));
  const executable = ordered.filter((c) => EXECUTABLE_CHANNELS.includes(c));
  const pending = ordered.filter((c) => !EXECUTABLE_CHANNELS.includes(c));

  const contactable_via =
    valid_email && phone ? "both" : valid_email ? "email" : phone ? "phone" : "none";

  return {
    has_email: !!valid_email,
    has_phone: !!phone,
    email: valid_email,
    phone,
    available,
    executable,
    pending,
    preferred: executable[0] ?? null,
    contactable_via,
    reason:
      contactable_via === "none"
        ? "no contact details on file"
        : executable.length === 0
          ? `contactable via phone only — requires a phone-capable channel (${pending.join(", ")})`
          : null,
  };
}
