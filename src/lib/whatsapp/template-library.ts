/**
 * WhatsApp template library — browser-safe.
 *
 * Defines the supported placeholder vocabulary and the ready-made (platform)
 * templates every agency can copy and customise. Nothing here sends messages.
 */

export const TEMPLATE_GROUPS = [
  { key: "policy", label: "Policy" },
  { key: "payments", label: "Payments" },
  { key: "motor", label: "Motor" },
  { key: "claims", label: "Claims" },
  { key: "quotations", label: "Quotations" },
  { key: "service", label: "Customer service" },
  { key: "consent", label: "WhatsApp & consent" },
] as const;

export type TemplateGroup = (typeof TEMPLATE_GROUPS)[number]["key"];

/** Placeholders the engine can actually resolve, with preview sample values. */
export const TEMPLATE_VARIABLES: Record<string, { label: string; sample: string; group: string }> = {
  customer_name: { label: "Customer full name", sample: "John Kamau", group: "Customer" },
  customer_first_name: { label: "Customer first name", sample: "John", group: "Customer" },
  customer_phone: { label: "Customer phone", sample: "+254712345678", group: "Customer" },

  agency_name: { label: "Agency name", sample: "Zest Insurance Agency", group: "Agency" },
  agency_phone: { label: "Agency phone", sample: "+254700000000", group: "Agency" },
  agency_email: { label: "Agency email", sample: "info@zestinsurance.co.ke", group: "Agency" },
  agency_website: { label: "Agency website", sample: "www.zestinsurance.co.ke", group: "Agency" },

  policy_number: { label: "Policy number", sample: "POL-000123", group: "Policy" },
  policy_type: { label: "Policy type", sample: "Motor Private", group: "Policy" },
  policy_start_date: { label: "Cover start date", sample: "15 October 2026", group: "Policy" },
  policy_expiry_date: { label: "Cover expiry date", sample: "14 October 2027", group: "Policy" },
  premium_amount: { label: "Premium amount", sample: "KES 42,500", group: "Policy" },
  outstanding_amount: { label: "Outstanding balance", sample: "KES 12,500", group: "Policy" },

  vehicle_registration: { label: "Vehicle registration", sample: "KDA 123A", group: "Vehicle" },
  vehicle_make: { label: "Vehicle make", sample: "Toyota", group: "Vehicle" },
  vehicle_model: { label: "Vehicle model", sample: "Fielder", group: "Vehicle" },

  payment_reference: { label: "Payment reference", sample: "SJ34KD9QW1", group: "Payment" },
  payment_amount: { label: "Payment amount", sample: "KES 30,000", group: "Payment" },
  payment_date: { label: "Payment date", sample: "12 September 2026", group: "Payment" },
  payment_method: { label: "Payment method", sample: "M-Pesa", group: "Payment" },
  payment_link: { label: "Payment link", sample: "https://example.com/pay/123", group: "Payment" },

  claim_number: { label: "Claim number", sample: "CLM-000045", group: "Claim" },
  claim_type: { label: "Claim type", sample: "Own damage", group: "Claim" },
  claim_status: { label: "Claim status", sample: "Under review", group: "Claim" },
  claim_date: { label: "Claim date", sample: "2 September 2026", group: "Claim" },
  claim_amount: { label: "Claim amount", sample: "KES 180,000", group: "Claim" },

  quote_number: { label: "Quotation number", sample: "QT-000210", group: "Quotation" },
  quote_amount: { label: "Quotation amount", sample: "KES 45,900", group: "Quotation" },
  quote_expiry_date: { label: "Quotation expiry date", sample: "30 September 2026", group: "Quotation" },
  quote_link: { label: "Quotation link", sample: "https://example.com/quote/210", group: "Quotation" },

  document_name: { label: "Document name", sample: "Motor certificate", group: "Document" },
  document_link: { label: "Document link", sample: "https://example.com/doc/abc", group: "Document" },

  agent_name: { label: "Agent name", sample: "Mary Wanjiru", group: "Staff" },
  agent_phone: { label: "Agent phone", sample: "+254711111111", group: "Staff" },

  service_request_number: { label: "Service request number", sample: "SR-000078", group: "Service request" },
  service_request_status: { label: "Service request status", sample: "In progress", group: "Service request" },
};

export const SUPPORTED_VARIABLES = Object.keys(TEMPLATE_VARIABLES);

/** Every {{name}} used in a body, in first-appearance order. Numbered ones are ignored. */
export function extractVariables(body: string): string[] {
  const out: string[] = [];
  for (const m of String(body ?? "").matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)) {
    const name = m[1];
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

export function unsupportedVariables(body: string): string[] {
  return extractVariables(body).filter((v) => !SUPPORTED_VARIABLES.includes(v));
}

/** Fills a body with realistic sample values for the preview panel. */
export function previewWithSamples(body: string, overrides: Record<string, string> = {}): string {
  return String(body ?? "").replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_all, name: string) =>
    overrides[name] ?? TEMPLATE_VARIABLES[name]?.sample ?? `{{${name}}}`,
  );
}

export interface LibraryTemplate {
  name: string;
  display_name: string;
  group: TemplateGroup;
  description: string;
  category: "UTILITY" | "MARKETING";
  body: string;
}

const t = (
  name: string,
  display_name: string,
  group: TemplateGroup,
  description: string,
  body: string,
  category: "UTILITY" | "MARKETING" = "UTILITY",
): LibraryTemplate => ({ name, display_name, group, description, category, body: body.trim() });

export const LIBRARY_TEMPLATES: LibraryTemplate[] = [
  // ---------------- Policy ----------------
  t("policy_issued", "Policy Issued", "policy", "Sent once a policy has been issued.", `
Hello {{customer_first_name}}, your {{policy_type}} insurance policy {{policy_number}} with {{agency_name}} has been successfully issued.

Your policy is valid from {{policy_start_date}} to {{policy_expiry_date}}.

Your policy documents are available here: {{document_link}}

For assistance, contact {{agency_phone}}.

Thank you for choosing {{agency_name}}.`),
  t("policy_renewal_60_days", "Policy Renewal — 60 Days", "policy", "Early renewal notice, 60 days before expiry.", `
Hello {{customer_first_name}}, your {{policy_type}} policy {{policy_number}} expires on {{policy_expiry_date}}.

Your policy renewal is due in approximately 60 days.

Please contact {{agency_name}} on {{agency_phone}} to discuss your renewal.`),
  t("policy_renewal_30_days", "Policy Renewal — 30 Days", "policy", "Renewal notice, 30 days before expiry.", `
Hello {{customer_first_name}}, your {{policy_type}} policy {{policy_number}} expires on {{policy_expiry_date}}.

Your policy renewal is due in approximately 30 days.

Please contact {{agency_name}} on {{agency_phone}} to arrange your renewal and avoid a lapse in cover.`),
  t("policy_renewal_14_days", "Policy Renewal — 14 Days", "policy", "Renewal reminder, 14 days before expiry.", `
Hello {{customer_first_name}}, this is a reminder that your {{policy_type}} policy {{policy_number}} expires on {{policy_expiry_date}}.

There are approximately 14 days remaining.

Please contact {{agency_name}} on {{agency_phone}} to arrange your renewal.`),
  t("policy_renewal_7_days", "Policy Renewal — 7 Days", "policy", "Renewal reminder, 7 days before expiry.", `
Hello {{customer_first_name}}, your {{policy_type}} policy {{policy_number}} expires on {{policy_expiry_date}}.

There are approximately 7 days remaining.

Please arrange your renewal with {{agency_name}} on {{agency_phone}} to avoid interruption of cover.`),
  t("policy_renewal_1_day", "Policy Renewal — 1 Day", "policy", "Final renewal reminder, the day before expiry.", `
Hello {{customer_first_name}}, your {{policy_type}} policy {{policy_number}} expires tomorrow, {{policy_expiry_date}}.

Please contact {{agency_name}} on {{agency_phone}} urgently to arrange your renewal and avoid a lapse in cover.`),
  t("policy_expired", "Policy Expired", "policy", "Sent after a policy has lapsed.", `
Hello {{customer_first_name}}, your {{policy_type}} policy {{policy_number}} has expired as of {{policy_expiry_date}}.

Please contact {{agency_name}} on {{agency_phone}} if you would like assistance with renewal.`),
  t("policy_cancelled", "Policy Cancelled", "policy", "Confirms a cancelled policy.", `
Hello {{customer_first_name}}, your {{policy_type}} policy {{policy_number}} has been cancelled.

Please contact {{agency_name}} on {{agency_phone}} if you require further information or assistance.`),
  t("policy_suspended", "Policy Suspended", "policy", "Confirms a suspended policy.", `
Hello {{customer_first_name}}, your {{policy_type}} policy {{policy_number}} has been suspended.

Please contact {{agency_name}} on {{agency_phone}} for information on the next steps.`),
  t("policy_reinstated", "Policy Reinstated", "policy", "Confirms a reinstated policy.", `
Hello {{customer_first_name}}, your {{policy_type}} policy {{policy_number}} has been reinstated.

Your cover is now active according to the terms of your policy.

For assistance, contact {{agency_phone}}.`),
  t("policy_documents_ready", "Policy Documents Ready", "policy", "Tells the customer documents are available.", `
Hello {{customer_first_name}}, your {{policy_type}} policy documents for policy {{policy_number}} are now ready.

You can access them here: {{document_link}}

For assistance, contact {{agency_phone}}.`),
  t("policy_document_delivery", "Policy Document Delivery", "policy", "Delivers a named document.", `
Hello {{customer_first_name}}, please find your {{document_name}} for policy {{policy_number}} here: {{document_link}}

If you have any questions, contact {{agency_phone}}.`),
  t("policy_endorsement_completed", "Policy Update / Endorsement Completed", "policy", "Confirms an endorsement.", `
Hello {{customer_first_name}}, an update to your {{policy_type}} policy {{policy_number}} has been completed.

Please contact {{agency_phone}} if you require further information or updated documents.`),

  // ---------------- Payments ----------------
  t("payment_received", "Payment Received", "payments", "Confirms a received payment.", `
Hello {{customer_first_name}}, we have received your payment of {{payment_amount}} for policy {{policy_number}}.

Payment reference: {{payment_reference}}

Thank you for your payment.

{{agency_name}}`),
  t("payment_failed", "Payment Failed", "payments", "Tells the customer a payment did not go through.", `
Hello {{customer_first_name}}, we were unable to process your payment of {{payment_amount}} for policy {{policy_number}}.

Please contact {{agency_name}} on {{agency_phone}} for assistance.`),
  t("payment_reminder", "Payment Reminder", "payments", "Reminds the customer of an outstanding balance.", `
Hello {{customer_first_name}}, this is a reminder that a payment of {{outstanding_amount}} is outstanding on policy {{policy_number}}.

Please contact {{agency_name}} on {{agency_phone}} or use the payment option provided by your agency.`),
  t("payment_due_today", "Payment Due Today", "payments", "Sent on the due date.", `
Hello {{customer_first_name}}, your payment of {{outstanding_amount}} for policy {{policy_number}} is due today.

Please make your payment to keep your account up to date.

For assistance, contact {{agency_phone}}.`),
  t("payment_overdue", "Payment Overdue", "payments", "Sent when a balance is past due.", `
Hello {{customer_first_name}}, your payment of {{outstanding_amount}} for policy {{policy_number}} is overdue.

Please contact {{agency_name}} on {{agency_phone}} to discuss payment arrangements and avoid disruption of your cover.`),
  t("payment_extension_approved", "Payment Extension Approved", "payments", "Confirms an approved extension.", `
Hello {{customer_first_name}}, your payment extension for policy {{policy_number}} has been approved.

Please contact {{agency_name}} on {{agency_phone}} if you need further information.`),
  t("payment_extension_expiring", "Payment Extension Expiring", "payments", "Warns that an extension is ending.", `
Hello {{customer_first_name}}, your payment extension for policy {{policy_number}} is approaching its deadline.

Please contact {{agency_name}} on {{agency_phone}} to ensure your account remains up to date.`),
  t("payment_receipt_available", "Payment Receipt Available", "payments", "Shares a receipt link.", `
Hello {{customer_first_name}}, your payment receipt for {{payment_amount}} relating to policy {{policy_number}} is now available.

You can access it here: {{document_link}}

Thank you.`),

  // ---------------- Motor ----------------
  t("vehicle_inspection_required", "Vehicle Inspection Required", "motor", "Requests a vehicle inspection.", `
Hello {{customer_first_name}}, a vehicle inspection is required for your vehicle {{vehicle_registration}} before your insurance can proceed.

Please contact {{agency_name}} on {{agency_phone}} for inspection arrangements.`),
  t("vehicle_inspection_reminder", "Vehicle Inspection Reminder", "motor", "Reminder for a pending inspection.", `
Hello {{customer_first_name}}, this is a reminder that your vehicle inspection for {{vehicle_registration}} is still pending.

Please contact {{agency_name}} on {{agency_phone}} to arrange the inspection.`),
  t("vehicle_inspection_completed", "Vehicle Inspection Completed", "motor", "Confirms a completed inspection.", `
Hello {{customer_first_name}}, your vehicle inspection for {{vehicle_registration}} has been completed.

Your insurance application will proceed to the next stage.

For assistance, contact {{agency_phone}}.`),
  t("vehicle_inspection_action_required", "Vehicle Inspection — Action Required", "motor", "Inspection needs follow-up.", `
Hello {{customer_first_name}}, further action is required following the inspection of vehicle {{vehicle_registration}}.

Please contact {{agency_name}} on {{agency_phone}} for more information.`),
  t("motor_certificate_ready", "Motor Certificate Ready", "motor", "Shares the motor certificate.", `
Hello {{customer_first_name}}, your motor insurance certificate for vehicle {{vehicle_registration}} is now ready.

Access your document here: {{document_link}}

For assistance, contact {{agency_phone}}.`),
  t("motor_policy_renewal", "Motor Policy Renewal", "motor", "Motor-specific renewal reminder.", `
Hello {{customer_first_name}}, your motor insurance policy {{policy_number}} for vehicle {{vehicle_registration}} expires on {{policy_expiry_date}}.

Please contact {{agency_name}} on {{agency_phone}} to arrange your renewal and keep your cover active.`),
  t("motor_policy_expired", "Motor Policy Expired", "motor", "Motor cover has lapsed.", `
Hello {{customer_first_name}}, your motor insurance policy {{policy_number}} for vehicle {{vehicle_registration}} expired on {{policy_expiry_date}}.

Driving without valid cover is an offence. Please contact {{agency_name}} on {{agency_phone}} for assistance with renewal.`),

  // ---------------- Claims ----------------
  t("claim_received", "Claim Received", "claims", "Acknowledges a new claim.", `
Hello {{customer_first_name}}, we have received your claim relating to policy {{policy_number}}.

Our team is reviewing it and will be in touch shortly.

{{agency_name}}`),
  t("claim_reference_created", "Claim Reference Created", "claims", "Shares the claim reference.", `
Hello {{customer_first_name}}, your claim has been registered.

Claim number: {{claim_number}}
Policy: {{policy_number}}

Please quote this number in all correspondence.`),
  t("claim_documents_required", "Claim Documents Required", "claims", "Requests claim documents.", `
Hello {{customer_first_name}}, additional documents are required to progress claim {{claim_number}}.

Please contact {{agency_name}} on {{agency_phone}} for the list of documents required.`),
  t("claim_documents_received", "Claim Documents Received", "claims", "Confirms documents received.", `
Hello {{customer_first_name}}, we have received the documents for claim {{claim_number}}.

Your claim will now proceed to the next stage of assessment.`),
  t("claim_under_review", "Claim Under Review", "claims", "Status update while assessing.", `
Hello {{customer_first_name}}, claim {{claim_number}} is currently under review.

We will update you as soon as the assessment is complete.

{{agency_name}}`),
  t("claim_approved", "Claim Approved", "claims", "Claim approved notification.", `
Hello {{customer_first_name}}, we are pleased to inform you that claim {{claim_number}} has been approved.

Our team will contact you regarding the settlement process.

For assistance, contact {{agency_phone}}.`),
  t("claim_rejected", "Claim Rejected", "claims", "Claim declined notification.", `
Hello {{customer_first_name}}, following assessment, claim {{claim_number}} has not been approved.

Please contact {{agency_name}} on {{agency_phone}} for a full explanation and to discuss your options.`),
  t("claim_more_information_required", "Claim Additional Information Required", "claims", "Requests more information.", `
Hello {{customer_first_name}}, additional information is required to complete the assessment of claim {{claim_number}}.

Please contact {{agency_name}} on {{agency_phone}} at your earliest convenience.`),
  t("claim_settled", "Claim Settled", "claims", "Claim settled notification.", `
Hello {{customer_first_name}}, claim {{claim_number}} has been settled.

Thank you for your patience throughout the process.

{{agency_name}}`),
  t("claim_payment_processed", "Claim Payment Processed", "claims", "Claim payment released.", `
Hello {{customer_first_name}}, payment of {{claim_amount}} for claim {{claim_number}} has been processed.

Please contact {{agency_phone}} if you have any questions.`),

  // ---------------- Quotations ----------------
  t("quote_created", "Quote Created", "quotations", "Confirms a quotation request.", `
Hello {{customer_first_name}}, we have prepared quotation {{quote_number}} for you.

Our team will share the details shortly.

{{agency_name}}`),
  t("quote_ready", "Quote Ready", "quotations", "Shares a ready quotation.", `
Hello {{customer_first_name}}, your quotation {{quote_number}} is ready.

Amount: {{quote_amount}}
Valid until: {{quote_expiry_date}}

View it here: {{quote_link}}

For assistance, contact {{agency_phone}}.`),
  t("quote_follow_up", "Quote Follow-up", "quotations", "Follows up on an open quotation.", `
Hello {{customer_first_name}}, we are following up on quotation {{quote_number}} of {{quote_amount}}.

Please let us know if you would like to proceed or discuss other options.

{{agency_name}}`),
  t("quote_expiring_soon", "Quote Expiring Soon", "quotations", "Warns a quotation is about to expire.", `
Hello {{customer_first_name}}, quotation {{quote_number}} expires on {{quote_expiry_date}}.

Please contact {{agency_name}} on {{agency_phone}} if you would like to proceed.`),
  t("quote_expired", "Quote Expired", "quotations", "Quotation has expired.", `
Hello {{customer_first_name}}, your insurance quotation {{quote_number}} has expired.

Please contact {{agency_name}} on {{agency_phone}} if you would like a new quotation.`),
  t("quote_accepted", "Quote Accepted", "quotations", "Acknowledges acceptance.", `
Hello {{customer_first_name}}, we have received your acceptance of quotation {{quote_number}}.

Our team will contact you regarding the next steps.

{{agency_name}}`),
  t("quote_rejected", "Quote Rejected", "quotations", "Acknowledges a declined quotation.", `
Hello {{customer_first_name}}, we have received your response regarding quotation {{quote_number}}.

Please contact {{agency_name}} on {{agency_phone}} if you would like to discuss other options.`),

  // ---------------- Customer service ----------------
  t("welcome", "Welcome", "service", "First greeting on WhatsApp.", `
Hello {{customer_first_name}}, welcome to {{agency_name}}.

We are here to help you with your insurance needs.

You can ask us about your policy, payments, claims, quotations and documents.`),
  t("registration_completed", "Customer Registration Completed", "service", "Confirms registration.", `
Hello {{customer_first_name}}, your registration with {{agency_name}} has been completed successfully.

Welcome aboard.

For assistance, contact {{agency_phone}}.`),
  t("documents_required", "Documents Required", "service", "Requests documents.", `
Hello {{customer_first_name}}, we require additional documents to complete your request.

Please contact {{agency_name}} on {{agency_phone}} for information on what is required.`),
  t("missing_documents_reminder", "Missing Documents Reminder", "service", "Reminder for outstanding documents.", `
Hello {{customer_first_name}}, this is a reminder that some documents required for your request are still outstanding.

Please contact {{agency_name}} on {{agency_phone}}.`),
  t("service_request_received", "Service Request Received", "service", "Acknowledges a service request.", `
Hello {{customer_first_name}}, we have received your service request.

Reference: {{service_request_number}}

Our team will review it and get back to you.`),
  t("service_request_updated", "Service Request Updated", "service", "Status update on a service request.", `
Hello {{customer_first_name}}, there has been an update to service request {{service_request_number}}.

Status: {{service_request_status}}

Contact {{agency_phone}} if you need assistance.`),
  t("service_request_completed", "Service Request Completed", "service", "Service request closed.", `
Hello {{customer_first_name}}, service request {{service_request_number}} has been completed.

Please contact {{agency_name}} if you require further assistance.`),
  t("human_agent_escalation", "Human Agent Escalation", "service", "Hand-over to a person.", `
Hello {{customer_first_name}}, we are connecting you with a member of our team who can assist you further.

Please wait while an agent takes over the conversation.`),
  t("agent_will_contact_you", "Agent Will Contact You", "service", "Promise of a call-back.", `
Hello {{customer_first_name}}, your request has been forwarded to our team.

An agent will contact you shortly.

Thank you for your patience.`),
  t("customer_feedback_request", "Customer Feedback Request", "service", "Asks for feedback.", `
Hello {{customer_first_name}}, we would appreciate your feedback about your recent experience with {{agency_name}}.

Your feedback helps us improve our service.`, "MARKETING"),

  // ---------------- Consent ----------------
  t("whatsapp_opt_in", "WhatsApp Opt-in Confirmation", "consent", "Confirms opt-in.", `
Hello {{customer_first_name}}, you have successfully opted in to receive WhatsApp communications from {{agency_name}}.

You may receive policy, payment, claims and service updates here.`),
  t("whatsapp_opt_out", "WhatsApp Opt-out Confirmation", "consent", "Confirms opt-out.", `
You have successfully opted out of WhatsApp communications from {{agency_name}}.

You will no longer receive automated WhatsApp messages from us.

If you wish to receive messages again, please contact {{agency_phone}}.`),
  t("whatsapp_resubscribe", "WhatsApp Re-subscription Confirmation", "consent", "Confirms re-subscription.", `
Hello {{customer_first_name}}, you have successfully opted back in to receive WhatsApp communications from {{agency_name}}.

You may now receive relevant policy, payment, claims and service updates.`),
  t("session_window_expired", "Customer Service Window Expired", "consent", "Explains the 24-hour window.", `
Hello {{customer_first_name}}, this conversation has been inactive for more than 24 hours.

Please send us a new message to continue the conversation.

If you need assistance, {{agency_name}} is available on {{agency_phone}}.`),
];

export const LIBRARY_BY_NAME = Object.fromEntries(LIBRARY_TEMPLATES.map((x) => [x.name, x]));
