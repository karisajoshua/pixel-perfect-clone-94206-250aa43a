import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  claimNo?: string
  status?: string
  notes?: string
}

const Email = ({
  clientName = 'Valued Client',
  claimNo = 'CLM-XXXX',
  status = 'updated',
  notes = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Update on claim ${claimNo}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><Text style={brandText}>Zest Insurance</Text></Section>
        <Heading style={h1}>Claim update</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          Your claim <strong>{claimNo}</strong> is now <strong>{status}</strong>.
        </Text>
        {notes && (
          <Section style={card}>
            <Text style={rowText}>{notes}</Text>
          </Section>
        )}
        <Text style={text}>
          Reply to this email if you have any questions or need to share more documents.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Claim ${d.claimNo ?? ''} is now ${d.status ?? 'updated'}`,
  displayName: 'Claim Status Update',
  previewData: {
    clientName: 'Jane Doe',
    claimNo: 'CLM-2026-00045',
    status: 'approved',
    notes: 'Assessor visit completed. Payout has been authorised and will be processed within 3 business days.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { paddingBottom: '12px' }
const brandText = { color: '#f59e0b', fontSize: '18px', fontWeight: 700 as const, letterSpacing: '0.4px', margin: 0 }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700 as const, margin: '16px 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '12px 0' }
const card = { backgroundColor: '#f8fafc', borderRadius: '10px', padding: '16px 18px', margin: '16px 0' }
const rowText = { color: '#0f172a', fontSize: '14px', lineHeight: '22px', margin: '4px 0' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: 0 }