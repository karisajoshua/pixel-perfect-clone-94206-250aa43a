import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  policyNo?: string
  endDate?: string
  daysToExpiry?: number
}

const Email = ({
  clientName = 'Valued Client',
  policyNo = 'POL-XXXX',
  endDate = '',
  daysToExpiry = 30,
}: Props) => {
  const urgency =
    daysToExpiry <= 1
      ? 'expires tomorrow'
      : daysToExpiry <= 7
        ? `expires in just ${daysToExpiry} days`
        : `is up for renewal in ${daysToExpiry} days`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Policy ${policyNo} ${urgency}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brand}>
            <img src="https://app.zestinsurance.co.ke/__l5e/assets-v1/eebb88a1-040c-4590-ba83-e847a4eed58e/zia-logo-red.png" alt="Zest Insurance Agency" height="60" style={{ display: "block", border: 0 }} />
          </Section>
          <Heading style={h1}>Time to renew your cover</Heading>
          <Text style={text}>Hi {clientName},</Text>
          <Text style={text}>
            This is a friendly reminder that your policy <strong>{policyNo}</strong> {urgency}
            {endDate ? ` (expires on ${endDate})` : ''}. Renewing on time keeps you continuously
            covered and avoids any lapse in protection.
          </Text>
          <Section style={ctaSection}>
            <Button style={button} href="mailto:renewals@zestinsurance.co.ke">
              Reply to renew
            </Button>
          </Section>
          <Text style={text}>
            Need help, a quote comparison, or want to adjust your cover? Just reply to this email
            and one of our agents will get right back to you.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Renewal reminder: Policy ${data.policyNo ?? ''} renews in ${data.daysToExpiry ?? 30} day${data.daysToExpiry === 1 ? '' : 's'}`,
  displayName: 'Policy Renewal Reminder',
  previewData: {
    clientName: 'Jane Doe',
    policyNo: 'POL-2026-00123',
    endDate: '2026-07-17',
    daysToExpiry: 30,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { paddingBottom: '12px' }
const brandText = {
  color: '#f59e0b',
  fontSize: '18px',
  fontWeight: 700 as const,
  letterSpacing: '0.4px',
  margin: 0,
}
const h1 = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 700 as const,
  margin: '16px 0 12px',
}
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '12px 0' }
const ctaSection = { padding: '20px 0' }
const button = {
  backgroundColor: '#f59e0b',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 22px',
  fontSize: '15px',
  fontWeight: 600 as const,
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: 0 }
