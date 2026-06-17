import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  invoiceNo?: string
  amount?: string
  paidAt?: string
  method?: string
  reference?: string
}

const Email = ({
  clientName = 'Valued Client',
  invoiceNo = 'INV-XXXX',
  amount = '',
  paidAt = '',
  method = '',
  reference = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Receipt for invoice ${invoiceNo}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><Text style={brandText}>Zest Insurance</Text></Section>
        <Heading style={h1}>Payment received</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          Thank you — we've received your payment for invoice <strong>{invoiceNo}</strong>.
        </Text>
        <Section style={card}>
          {amount && <Row label="Amount" value={amount} />}
          {method && <Row label="Method" value={method} />}
          {reference && <Row label="Reference" value={reference} />}
          {paidAt && <Row label="Date" value={paidAt} />}
        </Section>
        <Text style={text}>If you need a formal tax receipt, just reply to this email.</Text>
        <Hr style={hr} />
        <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowText}>
    <span style={rowLabel}>{label}: </span>
    <strong>{value}</strong>
  </Text>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Receipt for invoice ${d.invoiceNo ?? ''}`,
  displayName: 'Payment Receipt',
  previewData: {
    clientName: 'Jane Doe',
    invoiceNo: 'INV-2026-00345',
    amount: 'KES 45,000',
    paidAt: '2026-06-17',
    method: 'M-PESA',
    reference: 'QWX7TR12',
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
const rowLabel = { color: '#64748b' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: 0 }