import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as renewalReminderTemplate } from './renewal-reminder'
import { template as policyIssuedTemplate } from './policy-issued'
import { template as paymentReceiptTemplate } from './payment-receipt'
import { template as claimUpdateTemplate } from './claim-update'
import { template as clientWelcomeTemplate } from './client-welcome'
import { template as quotationSentTemplate } from './quotation-sent'
import { template as invoiceIssuedTemplate } from './invoice-issued'
import { template as claimAcknowledgementTemplate } from './claim-acknowledgement'
import { template as portalInviteTemplate } from './portal-invite'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'renewal-reminder': renewalReminderTemplate,
  'policy-issued': policyIssuedTemplate,
  'payment-receipt': paymentReceiptTemplate,
  'claim-update': claimUpdateTemplate,
  'client-welcome': clientWelcomeTemplate,
  'quotation-sent': quotationSentTemplate,
  'invoice-issued': invoiceIssuedTemplate,
  'claim-acknowledgement': claimAcknowledgementTemplate,
  'portal-invite': portalInviteTemplate,
}
