import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  quoteNo?: string
  insurerName?: string
  premium?: string
  sumInsured?: string
  validUntil?: string
  productClass?: string
  coverType?: string
}

const Email = ({
  clientName = 'Valued Client',
  quoteNo = 'Q-XXXX',
  insurerName = '',
  premium = '',
  sumInsured = '',
  validUntil = '',
  productClass = '',
  coverType = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Your quotation ${quoteNo} is ready`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><img src="https://pixel-perfect-clone-94206.lovable.app/__l5e/assets-v1/eebb88a1-040c-4590-ba83-e847a4eed58e/zia-logo-red.png" alt="Zest Insurance Agency" height="60" style={{ display: "block", border: 0 }} /></Section>
        <Heading style={h1}>Your quotation is ready</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          Here are the details for quotation <strong>{quoteNo}</strong>. Reply to this email when you're ready to proceed and we'll prepare your policy.
        </Text>
        <Section style={card}>
          <Row label="Quotation" value={quoteNo} />
          {insurerName && <Row label="Insurer" value={insurerName} />}
          {productClass && <Row label="Product" value={productClass} />}
          {coverType && <Row label="Cover" value={coverType} />}
          {sumInsured && <Row label="Sum insured" value={sumInsured} />}
          {premium && <Row label="Premium" value={premium} />}
          {validUntil && <Row label="Valid until" value={validUntil} />}
        </Section>
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
  subject: (d: Record<string, any>) => `Quotation ${d.quoteNo ?? ''} from Zest Insurance`,
  displayName: 'Quotation Sent',
  previewData: {
    clientName: 'Jane Doe',
    quoteNo: 'Q-2026-00045',
    insurerName: 'Jubilee Insurance',
    premium: 'KES 45,000',
    sumInsured: 'KES 1,200,000',
    validUntil: '2026-07-01',
    productClass: 'Motor — Private',
    coverType: 'Comprehensive',
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