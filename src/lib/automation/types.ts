/**
 * Automation Engine — shared (browser-safe) types.
 * A workflow version stores an immutable `graph` + `trigger`.
 */

export type NodeType = "trigger" | "condition" | "delay" | "send-email" | "send-message" | "end";

export type Comparator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "contains"
  | "in"
  | "not_in"
  | "exists";


/** A single comparison against a dotted path in the run context, e.g. "event.payload.status". */
export interface ConditionLeaf {
  path: string;
  op: Comparator;
  value?: unknown;
}

export interface ConditionGroup {
  and?: Condition[];
  or?: Condition[];
}

export type Condition = ConditionLeaf | ConditionGroup;

export interface TriggerConfig {
  event_type: string;
  /** Optional filter evaluated against the run context before a run is created. */
  filter?: Condition;
  /**
   * Reusable relative-date configuration for scheduled triggers:
   * "fire when <date_field> is <offset> days away". Offsets are days BEFORE the
   * date (e.g. [60, 30, 14, 7, 1] for renewal reminders); negative = after.
   * The scheduler reads these from published versions, so windows are data,
   * never hard-coded in the engine.
   */
  relative_date?: {
    date_field?: string;
    offsets: number[];
  };
}

export interface DelayConfig {
  amount: number;
  unit: "minutes" | "hours" | "days";
}

export interface SendEmailConfig {
  /** Name from the email template registry, e.g. "renewal-reminder". */
  template: string;
  /** Path or template string for the recipient, e.g. "{{client.email}}". */
  to: string;
  /** Template props; string values may use {{path}} placeholders. */
  data?: Record<string, unknown>;
}

/**
 * Channel-aware send. The engine picks the first channel the customer is
 * reachable on, executes it when the channel is supported (email today) and
 * records a `pending_channel` step for channels that are not built yet
 * (whatsapp / sms) instead of failing the run.
 */
export interface SendMessageConfig extends SendEmailConfig {
  channels?: ("email" | "whatsapp" | "sms")[];
  /** Optional plain-text body used for the recorded phone-channel intent. */
  message?: string;
}


export interface WorkflowNode {
  id: string;
  type: NodeType;
  label?: string;
  config?: TriggerConfig | Condition | DelayConfig | SendEmailConfig | Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  /** For condition nodes: "true" | "false". */
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type RunStatus = "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export const SUPPORTED_EVENT_TYPES = [
  "policy.created",
  "policy.updated",
  "policy.expiring",
  "policy.expired",
  "payment.received",
  "payment.failed",
  "invoice.issued",
  "invoice.overdue",
  "claim.created",
  "claim.status_changed",
  "quotation.created",
  "quotation.approved",
  "quotation.not_converted",
  "client.created",
  "client.updated",
  "vehicle.inspection_due",
  "document.rejected",
  "document.expiring",
] as const;

export type EventType = (typeof SUPPORTED_EVENT_TYPES)[number];

/** Max attempts per node type before the run is failed. */
export const NODE_MAX_ATTEMPTS: Record<NodeType, number> = {
  trigger: 1,
  condition: 2,
  delay: 2,
  "send-email": 4,
  "send-message": 4,
  end: 1,
};

