/**
 * WhatsApp 24-hour customer-service window helpers (browser-safe).
 * Never hard-code the window elsewhere — always ask these helpers.
 */
import { WHATSAPP_SESSION_WINDOW_MS } from "./types";

export interface SessionConversation {
  last_inbound_at?: string | null;
}

export function isWhatsAppSessionOpen(
  conversation: SessionConversation | null | undefined,
  now: Date = new Date(),
): boolean {
  const last = conversation?.last_inbound_at;
  if (!last) return false;
  const ts = Date.parse(last);
  if (Number.isNaN(ts)) return false;
  return now.getTime() - ts < WHATSAPP_SESSION_WINDOW_MS;
}

/** Milliseconds left in the window, or 0 when it is closed. */
export function whatsAppSessionRemainingMs(
  conversation: SessionConversation | null | undefined,
  now: Date = new Date(),
): number {
  const last = conversation?.last_inbound_at;
  if (!last) return 0;
  const ts = Date.parse(last);
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, WHATSAPP_SESSION_WINDOW_MS - (now.getTime() - ts));
}
