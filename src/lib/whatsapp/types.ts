/**
 * WhatsApp gateway — shared, browser-safe types.
 *
 * The Automation Engine and UI only ever speak this vocabulary; Meta Cloud API
 * details stay inside `provider.server.ts`.
 */

export type MessagingProvider = "meta_cloud";

export type ChannelStatus = "not_connected" | "pending" | "connected" | "disabled" | "error";

export type ChannelMode = "test" | "production";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "received" | "skipped";

export type MessageType =
  | "text"
  | "template"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "sticker"
  | "location"
  | "interactive"
  | "other";

export type ConversationStatus = "open" | "bot" | "escalated" | "closed";

export type ConsentStatus = "opted_in" | "opted_out";

/** Meta's customer-service window, in milliseconds. */
export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SendResult {
  ok: boolean;
  /** Local conversation_messages row id, when one was created. */
  message_id: string | null;
  provider_message_id: string | null;
  status: MessageStatus;
  timestamp: string;
  dry_run?: boolean;
  test?: boolean;
  /** Set when the send was intentionally not performed (consent, mode, duplicate). */
  skipped_reason?: string;
  error?: string;
  error_code?: string;
  /** Whether the Automation Engine should retry this send. */
  retryable?: boolean;
  /** Human-readable summary of what was (or would be) sent. */
  preview?: Record<string, unknown>;
}

export interface SendCommon {
  tenantId: string;
  /** Raw recipient phone; normalised to E.164 by the gateway. */
  to: string;
  clientId?: string | null;
  idempotencyKey?: string | null;
  workflowRunId?: string | null;
  workflowStepId?: string | null;
  /** Dry-run: validate and log, never call the provider. */
  dryRun?: boolean;
  /** Explicitly flags a controlled test send. */
  test?: boolean;
  /** Conversational reply inside the 24h window — skips the opt-in requirement. */
  session?: boolean;
  label?: string;
  actorId?: string | null;
}

export interface SendTextArgs extends SendCommon {
  body: string;
}

export interface SendTemplateArgs extends SendCommon {
  template: string;
  language?: string;
  variables?: Record<string, unknown> | unknown[];
}

export interface SendMediaArgs extends SendCommon {
  mediaType: "image" | "document" | "audio" | "video";
  link: string;
  caption?: string;
  filename?: string;
}

/** Automation node config for the `send-whatsapp` action. */
export interface SendWhatsAppConfig {
  /** WhatsApp template name (required for business-initiated messages). */
  template?: string;
  language?: string;
  /** Template variables; string values may contain {{path}} placeholders. */
  variables?: Record<string, unknown>;
  /** Free-text body for session messages (only valid inside the 24h window). */
  message?: string;
  /** Recipient override, e.g. "{{client.phone}}". Defaults to the client's phone. */
  to?: string;
}
