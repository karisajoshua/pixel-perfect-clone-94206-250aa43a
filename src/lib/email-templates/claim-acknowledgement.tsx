import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  claimNo?: string
  policyNo?: string
  incidentDate?: string
  description?: string
}

const Email = ({
  clientName = 'Valued Client',
  claimNo = 'CLM-XXXX',
  policyNo = '',
  incidentDate = '',
  description = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`We've received your claim ${claimNo}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><img src="https://app.zestinsurance.co.ke/__l5e/assets-v1/eebb88a1-040c-4590-ba83-e847a4eed58e/zia-logo-red.png" alt="Zest Insurance Agency" height="60" style={{ display: "block", border: 0 }} /></Section>
        <Heading style={h1}>Claim received</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          We've received your claim <strong>{claimNo}</strong> and our team is now reviewing the details. We'll keep you updated as it progresses.
        </Text>
        <Section style={card}>
          <Row label="Claim" value={claimNo} />
          {policyNo && <Row label="Policy" value={policyNo} />}
          {incidentDate && <Row label="Incident date" value={incidentDate} />}
          {description && <Row label="Details" value={description} />}
        </Section>
        <Text style={text}>If you have additional photos, the police abstract, or other documents, just reply to this email and attach them.</Text>
        <Hr style={hr} />
        <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowText}><span style={rowLabel}>{label}: </span><strong>{value}</strong></Text>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Claim ${d.claimNo ?? ''} received`,
  displayName: 'Claim Acknowledgement',
  previewData: {
    clientName: 'Jane Doe',
    claimNo: 'CLM-2026-00045',
    policyNo: 'POL-2026-00123',
    incidentDate: '2026-06-15',
    description: 'Minor collision on Mombasa Road',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { paddingBottom: '12px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700 as const, margin: '16px 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '12px 0' }
const card = { backgroundColor: '#f8fafc', borderRadius: '10px', padding: '16px 18px', margin: '16px 0' }
const rowText = { color: '#0f172a', fontSize: '14px', lineHeight: '22px', margin: '4px 0' }
const rowLabel = { color: '#64748b' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: 0 }