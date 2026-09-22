export type WhatsAppBotIntent =
  | "renew_cover" | "new_policy" | "quotation" | "policy_status" | "claims" | "human" | "unknown";

export type WhatsAppBotState =
  | "idle" | "menu" | "awaiting_registration" | "awaiting_otp" | "verified"
  | "selecting_cover" | "awaiting_payment" | "processing" | "complete" | "human";

export function detectInsuranceIntent(input: string | null | undefined): WhatsAppBotIntent {
  const s=(input??"").trim().toLowerCase();
  if (/\b(renew|renewal|extend|expir)/.test(s)) return "renew_cover";
  if (/\b(new policy|new cover|buy cover|buy insurance|insure)/.test(s)) return "new_policy";
  if (/\b(quote|quotation|price|premium|cost)/.test(s)) return "quotation";
  if (/\b(policy|certificate|cover status|insurance status)/.test(s)) return "policy_status";
  if (/\b(claim|accident|incident|damage|loss)/.test(s)) return "claims";
  if (/\b(agent|human|person|staff|help me)/.test(s)) return "human";
  return "unknown";
}

export function isGreeting(input: string | null | undefined) {
  return /^(hi|hello|hey|habari|jambo|morning|afternoon|evening)\b/i.test((input??"").trim());
}

export function customerMenu(agencyName: string) {
  return `Welcome to ${agencyName}. How can we help you today?\n\n1. Renew my cover\n2. Buy a new policy\n3. Get a quotation\n4. Check my policy\n5. Claims assistance\n6. Speak to an agent\n\nReply with a number or tell us what you need.`;
}

export function intentFromMenu(input: string): WhatsAppBotIntent {
  const s=input.trim();
  return ({ "1":"renew_cover","2":"new_policy","3":"quotation","4":"policy_status","5":"claims","6":"human" } as Record<string,WhatsAppBotIntent>)[s] ?? detectInsuranceIntent(s);
}
