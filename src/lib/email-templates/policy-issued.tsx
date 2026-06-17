import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  policyNo?: string
  insurerName?: string
  startDate?: string
  endDate?: string
  premium?: string
}

const Email = ({
  clientName = 'Valued Client',
  policyNo = 'POL-XXXX',
  insurerName = 'your insurer',
  startDate = '',
  endDate = '',
  premium = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Your policy ${policyNo} is now active`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><Text style={brandText}>Zest Insurance</Text></Section>
        <Heading style={h1}>You're covered</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          Great news — your policy <strong>{policyNo}</strong> with {insurerName} is now active.
        </Text>
        <Section style={card}>
          <Row label="Policy number" value={policyNo} />
          {startDate && <Row label="Cover starts" value={startDate} />}
          {endDate && <Row label="Cover ends" value={endDate} />}
          {premium && <Row label="Premium" value={premium} />}
        </Section>
        <Text style={text}>
          Keep this email for your records. We'll send a renewal reminder before your cover ends.
        </Text>
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
  subject: (d: Record<string, any>) => `Policy ${d.policyNo ?? ''} is now active`,
  displayName: 'Policy Issued',
  previewData: {
    clientName: 'Jane Doe',
    policyNo: 'POL-2026-00123',
    insurerName: 'Jubilee Insurance',
    startDate: '2026-06-17',
    endDate: '2027-06-16',
    premium: 'KES 45,000',
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